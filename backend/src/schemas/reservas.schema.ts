import { z } from 'zod';
import { ESTADOS_RESERVA } from '../domain/estadosReserva.js';
import { validarRangoEstancia, ESTANCIA_MAXIMA_NOCHES } from '../domain/fechas.js';
import { fechaSchema, paginacionSchema, textoOpcional } from './comun.schema.js';
import { huespedNuevoSchema } from './huespedes.schema.js';

const cantidadHuespedes = z.coerce
  .number('Indica la cantidad de huéspedes')
  .int('Debe ser un número entero')
  .min(1, 'Debe haber al menos 1 huésped')
  .max(200, 'Máximo 200 huéspedes por reserva');

// Reglas de rango comunes: salida posterior a la entrada y estancia máxima
export function refinarRango<T extends { fechaEntrada?: string; fechaSalida?: string }>(
  d: T,
  ctx: z.RefinementCtx,
) {
  if (!d.fechaEntrada || !d.fechaSalida) return;
  const error = validarRangoEstancia(d.fechaEntrada, d.fechaSalida);
  if (error === 'SALIDA_NO_POSTERIOR') {
    ctx.addIssue({
      code: 'custom',
      path: ['fechaSalida'],
      message: 'La fecha de salida debe ser posterior a la de entrada',
    });
  } else if (error === 'ESTANCIA_DEMASIADO_LARGA') {
    ctx.addIssue({
      code: 'custom',
      path: ['fechaSalida'],
      message: `La estancia no puede superar ${ESTANCIA_MAXIMA_NOCHES} noches`,
    });
  }
}

export const crearReservaSchema = z
  .strictObject({
    // Huésped existente o datos de uno nuevo (exactamente uno de los dos)
    huespedId: z.uuid().optional(),
    huesped: huespedNuevoSchema.optional(),
    canalId: z.uuid('Selecciona el canal de origen'),
    fechaEntrada: fechaSchema,
    fechaSalida: fechaSchema,
    cantidadHuespedes,
    tipoHabitacionPreferidoId: z.uuid().nullable().optional(),
    notasOperativas: textoOpcional(2000),
    responsableId: z.uuid().nullable().optional(),
    // Estado inicial: el personal puede registrar una solicitud o dejarla pendiente de confirmación.
    // Para confirmar se usa el cambio de estado (exige camas asignadas).
    estadoInicial: z
      .enum(['SOLICITUD', 'PENDIENTE_CONFIRMACION'])
      .default('PENDIENTE_CONFIRMACION'),
    // Camas a asignar de una vez (opcional)
    camaIds: z.array(z.uuid()).max(60).optional(),
  })
  .refine((d) => (d.huespedId === undefined) !== (d.huesped === undefined), {
    message: 'Selecciona un huésped existente o registra uno nuevo',
    path: ['huesped'],
  })
  .superRefine(refinarRango);
export type CrearReservaInput = z.infer<typeof crearReservaSchema>;

export const actualizarReservaSchema = z
  .strictObject({
    fechaEntrada: fechaSchema.optional(),
    fechaSalida: fechaSchema.optional(),
    cantidadHuespedes: cantidadHuespedes.optional(),
    canalId: z.uuid().optional(),
    tipoHabitacionPreferidoId: z.uuid().nullable().optional(),
    notasOperativas: textoOpcional(2000),
    responsableId: z.uuid().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' })
  .superRefine(refinarRango);
export type ActualizarReservaInput = z.infer<typeof actualizarReservaSchema>;

export const cambiarEstadoSchema = z
  .strictObject({
    estado: z.enum(ESTADOS_RESERVA),
    motivo: textoOpcional(500),
  })
  .refine((d) => d.estado !== 'CANCELADA' || Boolean(d.motivo), {
    message: 'Indica el motivo de la cancelación',
    path: ['motivo'],
  });
export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;

export const asignarCamasSchema = z
  .strictObject({
    camaIds: z.array(z.uuid()).max(60).default([]),
    // Asigna todas las camas activas de estas habitaciones
    habitacionIds: z.array(z.uuid()).max(30).default([]),
  })
  .refine((d) => d.camaIds.length + d.habitacionIds.length > 0, {
    message: 'Selecciona al menos una cama o habitación',
    path: ['camaIds'],
  });
export type AsignarCamasInput = z.infer<typeof asignarCamasSchema>;

export const quitarCamaParamsSchema = z.strictObject({
  id: z.uuid(),
  camaId: z.uuid(),
});

export const listarReservasQuerySchema = z
  .strictObject({
    // Nombre, teléfono, correo o código (HR-00042)
    q: z.string().trim().max(100).optional(),
    estado: z
      .union([z.enum(ESTADOS_RESERVA), z.array(z.enum(ESTADOS_RESERVA)).max(6)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
    // Reservas cuya estancia se cruza con [desde, hasta)
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    canalId: z.uuid().optional(),
    orden: z.enum(['entrada', 'creacion']).default('entrada'),
    ...paginacionSchema,
  })
  .refine((d) => !d.desde || !d.hasta || d.hasta > d.desde, {
    message: '"hasta" debe ser posterior a "desde"',
    path: ['hasta'],
  });
export type ListarReservasQuery = z.infer<typeof listarReservasQuerySchema>;
