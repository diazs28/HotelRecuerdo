import { z } from 'zod';
import { esFechaValida } from '../domain/fechas.js';

export const idParamSchema = z.strictObject({ id: z.uuid('Identificador inválido') });
export type IdParam = z.infer<typeof idParamSchema>;

export const fechaSchema = z
  .string()
  .trim()
  .refine(esFechaValida, 'Fecha inválida (formato AAAA-MM-DD)');

// Texto opcional: vacío se guarda como null
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const textoObligatorio = (min: number, max: number, campo: string) =>
  z
    .string(`${campo} es obligatorio`)
    .trim()
    .min(min, `${campo} es obligatorio`)
    .max(max, `Máximo ${max} caracteres`);

// Teléfonos de Colombia o del exterior: dígitos, espacios, guiones, paréntesis y "+" inicial
export const telefonoSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Teléfono inválido');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email('Correo electrónico inválido'));

export const paginacionSchema = {
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
};

export const booleanoQuery = z.enum(['true', 'false']).transform((v) => v === 'true');
