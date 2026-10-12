import { z } from 'zod';
import { fechaSchema, textoObligatorio, textoOpcional } from './comun.schema.js';

export const TIPOS_CAMA = [
  'SENCILLA',
  'SEMIDOBLE',
  'DOBLE',
  'QUEEN',
  'KING',
  'LITERA',
  'AUXILIAR',
] as const;

const capacidad = z.coerce
  .number('Indica la capacidad')
  .int()
  .min(1, 'Mínimo 1 persona')
  .max(50, 'Máximo 50 personas');

const plazas = z.coerce.number().int().min(1, 'Mínimo 1 plaza').max(4, 'Máximo 4 plazas');

const camaNuevaSchema = z.strictObject({
  identificador: textoObligatorio(1, 30, 'El identificador de la cama'),
  tipo: z.enum(TIPOS_CAMA),
  plazas: plazas.default(1),
});

export const crearHabitacionSchema = z.strictObject({
  numero: textoObligatorio(1, 30, 'El número o nombre'),
  tipoHabitacionId: z.uuid('Selecciona el tipo de habitación'),
  capacidad,
  piso: textoOpcional(20),
  descripcion: textoOpcional(500),
  orden: z.coerce.number().int().min(0).max(10_000).default(0),
  // Camas iniciales (también se pueden agregar después)
  camas: z.array(camaNuevaSchema).max(20).default([]),
});
export type CrearHabitacionInput = z.infer<typeof crearHabitacionSchema>;

export const actualizarHabitacionSchema = z
  .strictObject({
    numero: textoObligatorio(1, 30, 'El número o nombre').optional(),
    tipoHabitacionId: z.uuid().optional(),
    capacidad: capacidad.optional(),
    piso: textoOpcional(20),
    descripcion: textoOpcional(500),
    orden: z.coerce.number().int().min(0).max(10_000).optional(),
    // false = retirar la habitación (y sus camas) del inventario
    activa: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
export type ActualizarHabitacionInput = z.infer<typeof actualizarHabitacionSchema>;

export const crearCamaSchema = camaNuevaSchema;
export type CrearCamaInput = z.infer<typeof crearCamaSchema>;

export const actualizarCamaSchema = z
  .strictObject({
    identificador: textoObligatorio(1, 30, 'El identificador de la cama').optional(),
    tipo: z.enum(TIPOS_CAMA).optional(),
    plazas: plazas.optional(),
    activa: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
export type ActualizarCamaInput = z.infer<typeof actualizarCamaSchema>;

export const listarHabitacionesQuerySchema = z.strictObject({
  incluirInactivas: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

export const crearBloqueoSchema = z
  .strictObject({
    tipo: z.enum(['BLOQUEO', 'MANTENIMIENTO']),
    habitacionId: z.uuid('Selecciona la habitación'),
    // Sin cama = toda la habitación
    camaId: z.uuid().nullable().optional(),
    fechaInicio: fechaSchema,
    // Exclusiva: primer día en que vuelve a estar disponible. Vacía = sin fecha de fin.
    fechaFin: fechaSchema.nullable().optional(),
    motivo: textoObligatorio(3, 300, 'El motivo'),
  })
  .refine((d) => !d.fechaFin || d.fechaFin > d.fechaInicio, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['fechaFin'],
  });
export type CrearBloqueoInput = z.infer<typeof crearBloqueoSchema>;

export const listarBloqueosQuerySchema = z.strictObject({
  habitacionId: z.uuid().optional(),
  vigentes: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(true),
});

export const disponibilidadQuerySchema = z
  .strictObject({
    desde: fechaSchema,
    hasta: fechaSchema,
  })
  .refine((d) => d.hasta > d.desde, {
    message: '"hasta" debe ser posterior a "desde"',
    path: ['hasta'],
  });

export const camasLibresQuerySchema = z
  .strictObject({
    fechaEntrada: fechaSchema,
    fechaSalida: fechaSchema,
    // Al editar una reserva, sus propias ocupaciones no cuentan como conflicto
    excluirReservaId: z.uuid().optional(),
  })
  .refine((d) => d.fechaSalida > d.fechaEntrada, {
    message: 'La fecha de salida debe ser posterior a la de entrada',
    path: ['fechaSalida'],
  });
