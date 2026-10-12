import { z } from 'zod';
import { CODIGOS_PERMISO } from '../domain/permisos.js';
import { emailSchema, paginacionSchema, textoObligatorio, textoOpcional } from './comun.schema.js';

// ---------- Autenticación ----------

const passwordNueva = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'Máximo 128 caracteres');

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const cambiarPasswordSchema = z
  .strictObject({
    passwordActual: z.string().min(1, 'Escribe tu contraseña actual').max(128),
    passwordNueva,
  })
  .refine((d) => d.passwordActual !== d.passwordNueva, {
    message: 'La nueva contraseña debe ser distinta de la actual',
    path: ['passwordNueva'],
  });
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;

// ---------- Usuarios del personal ----------

export const crearUsuarioSchema = z.strictObject({
  nombre: textoObligatorio(2, 150, 'El nombre'),
  email: emailSchema,
  rolId: z.uuid('Selecciona el rol'),
  // Contraseña inicial: la persona la cambia al ingresar
  password: passwordNueva,
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z
  .strictObject({
    nombre: textoObligatorio(2, 150, 'El nombre').optional(),
    rolId: z.uuid().optional(),
    activo: z.boolean().optional(),
    // Restablecer la contraseña (cierra las sesiones abiertas de esa persona)
    password: passwordNueva.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;

export const permisosRolSchema = z.strictObject({
  permisos: z.array(z.enum(CODIGOS_PERMISO)).max(CODIGOS_PERMISO.length),
});
export type PermisosRolInput = z.infer<typeof permisosRolSchema>;

// ---------- Catálogos ----------

export const tipoHabitacionSchema = z.strictObject({
  nombre: textoObligatorio(2, 80, 'El nombre'),
  descripcion: textoOpcional(500),
  capacidadSugerida: z.coerce.number().int().min(1).max(50).nullable().optional(),
  publicado: z.boolean().default(true),
  activo: z.boolean().default(true),
  orden: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type TipoHabitacionInput = z.infer<typeof tipoHabitacionSchema>;

export const actualizarTipoHabitacionSchema = tipoHabitacionSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
export type ActualizarTipoHabitacionInput = z.infer<typeof actualizarTipoHabitacionSchema>;

export const canalSchema = z.strictObject({
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{2,30}$/, 'Solo minúsculas, números y guion bajo (2 a 30)'),
  nombre: textoObligatorio(2, 80, 'El nombre'),
  activo: z.boolean().default(true),
  orden: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type CanalInput = z.infer<typeof canalSchema>;

export const actualizarCanalSchema = z
  .strictObject({
    nombre: textoObligatorio(2, 80, 'El nombre').optional(),
    activo: z.boolean().optional(),
    orden: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
export type ActualizarCanalInput = z.infer<typeof actualizarCanalSchema>;

// ---------- Auditoría ----------

export const listarAuditoriaQuerySchema = z.strictObject({
  entidad: z.string().trim().max(40).optional(),
  entidadId: z.uuid().optional(),
  usuarioId: z.uuid().optional(),
  ...paginacionSchema,
});
