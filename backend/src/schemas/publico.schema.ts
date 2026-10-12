import { z } from 'zod';
import { emailSchema, fechaSchema, telefonoSchema, textoObligatorio } from './comun.schema.js';
import { refinarRango } from './reservas.schema.js';

// Formulario público de solicitud. NO crea una reserva confirmada: el personal la revisa.
export const solicitudPublicaSchema = z
  .strictObject({
    fechaEntrada: fechaSchema,
    fechaSalida: fechaSchema,
    cantidadHuespedes: z.coerce
      .number('Indica cuántas personas se hospedan')
      .int()
      .min(1, 'Debe haber al menos 1 huésped')
      .max(60, 'Para grupos de más de 60 personas, escríbenos directamente'),
    tipoHabitacionId: z.uuid().nullable().optional(),
    nombres: textoObligatorio(1, 100, 'El nombre'),
    apellidos: textoObligatorio(1, 100, 'El apellido'),
    telefono: telefonoSchema,
    email: emailSchema.nullable().optional(),
    comentario: z
      .string()
      .trim()
      .max(1000, 'Máximo 1000 caracteres')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    aceptaTratamientoDatos: z.literal(true, {
      message: 'Debes autorizar el tratamiento de tus datos para enviar la solicitud',
    }),
    // Trampa para robots: el campo está oculto para las personas y debe llegar vacío
    sitioWeb: z.string().max(200).optional(),
  })
  .superRefine(refinarRango);
export type SolicitudPublicaInput = z.infer<typeof solicitudPublicaSchema>;

export const disponibilidadPublicaQuerySchema = z
  .strictObject({
    fechaEntrada: fechaSchema,
    fechaSalida: fechaSchema,
    cantidadHuespedes: z.coerce.number().int().min(1).max(60).default(1),
  })
  .superRefine(refinarRango);
export type DisponibilidadPublicaQuery = z.infer<typeof disponibilidadPublicaQuerySchema>;

// Clave de idempotencia que envía el navegador (un UUID por intento de envío del formulario)
export const claveIdempotenciaSchema = z
  .string('Falta la cabecera Idempotency-Key')
  .trim()
  .regex(/^[A-Za-z0-9_-]{16,100}$/, 'Idempotency-Key inválida');
