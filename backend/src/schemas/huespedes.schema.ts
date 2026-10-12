import { z } from 'zod';
import { emailSchema, paginacionSchema, telefonoSchema, textoObligatorio } from './comun.schema.js';

export const TIPOS_DOCUMENTO = ['CC', 'CE', 'PASAPORTE', 'TI', 'PPT', 'OTRO'] as const;

// Datos mínimos del huésped titular. Teléfono o correo: al menos uno para poder responderle.
const camposHuesped = {
  nombres: textoObligatorio(1, 100, 'El nombre'),
  apellidos: textoObligatorio(1, 100, 'El apellido'),
  telefono: telefonoSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO).nullable().optional(),
  numeroDocumento: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,30}$/, 'Número de documento inválido')
    .nullable()
    .optional(),
};

function documentoCoherente(d: { tipoDocumento?: unknown; numeroDocumento?: unknown }) {
  return (d.tipoDocumento == null) === (d.numeroDocumento == null);
}
const mensajeDocumento = {
  message: 'Indica el tipo y el número de documento juntos',
  path: ['numeroDocumento'],
};

export const huespedNuevoSchema = z
  .strictObject(camposHuesped)
  .refine((d) => Boolean(d.telefono ?? d.email), {
    message: 'Indica un teléfono o un correo electrónico',
    path: ['telefono'],
  })
  .refine(documentoCoherente, mensajeDocumento);
export type HuespedNuevoInput = z.infer<typeof huespedNuevoSchema>;

export const actualizarHuespedSchema = z
  .strictObject({
    nombres: camposHuesped.nombres.optional(),
    apellidos: camposHuesped.apellidos.optional(),
    telefono: camposHuesped.telefono,
    email: camposHuesped.email,
    tipoDocumento: camposHuesped.tipoDocumento,
    numeroDocumento: camposHuesped.numeroDocumento,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' })
  .refine(
    (d) => (d.tipoDocumento === undefined) === (d.numeroDocumento === undefined),
    mensajeDocumento,
  )
  .refine(documentoCoherente, mensajeDocumento);
export type ActualizarHuespedInput = z.infer<typeof actualizarHuespedSchema>;

export const listarHuespedesQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  ...paginacionSchema,
});
export type ListarHuespedesQuery = z.infer<typeof listarHuespedesQuerySchema>;
