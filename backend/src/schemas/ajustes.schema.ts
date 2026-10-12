import { z } from 'zod';
import { emailSchema, telefonoSchema } from './comun.schema.js';

// Datos configurables del hotel. Cada clave tiene su esquema; todos los campos son opcionales para
// poder guardar lo que la administración vaya confirmando. Un ajuste solo llega al sitio público si
// está marcado como confirmado Y publicado.

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const urlHttps = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === '' ? null : v))
  .pipe(z.url({ protocol: /^https$/, message: 'Debe ser un enlace https://' }).nullable())
  .nullable()
  .optional();

// WhatsApp: solo dígitos con indicativo de país (57 + 10 dígitos para Colombia)
const whatsapp = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()+-]/g, ''))
  .pipe(z.string().regex(/^(\d{11,15})?$/, 'Usa el indicativo y el número, ej. 573001234567'))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const hora = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .pipe(
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM, 24 horas)')
      .nullable(),
  )
  .nullable()
  .optional();

const servicio = z.strictObject({
  descripcion: texto(500),
  horario: texto(120),
  condiciones: texto(500),
});

export const ESQUEMAS_AJUSTE = {
  contacto: z.strictObject({
    telefono: telefonoSchema.nullable().optional(),
    whatsapp,
    email: emailSchema.nullable().optional(),
    direccion: texto(200),
    ciudad: texto(80),
    mapaUrl: urlHttps,
    instagram: urlHttps,
    facebook: urlHttps,
  }),
  horarios: z.strictObject({
    entrada: hora,
    salida: hora,
    notas: texto(300),
  }),
  servicio_desayuno: servicio,
  servicio_parqueadero: servicio,
  servicio_wifi: servicio,
  restaurante: z.strictObject({
    descripcion: texto(800),
    horario: texto(160),
  }),
  politicas: z.strictObject({
    cancelacion: texto(1500),
    anticipos: texto(1500),
    noPresentacion: texto(1500),
    cambios: texto(1500),
    grupos: texto(1500),
    menores: texto(1500),
    mascotas: texto(1500),
    huespedesAdicionales: texto(1500),
  }),
  // Solo informativas: el sistema no calcula precios (docs/adr/0005)
  tarifas: z.strictObject({
    vigencia: texto(120),
    notas: texto(800),
    items: z
      .array(
        z.strictObject({
          concepto: z.string().trim().min(1).max(120),
          valor: z.string().trim().min(1).max(60),
        }),
      )
      .max(30)
      .default([]),
  }),
  tratamiento_datos: z.strictObject({
    responsable: texto(150),
    nit: texto(30),
    correoContacto: emailSchema.nullable().optional(),
    politicaUrl: urlHttps,
    version: texto(20),
  }),
} as const;

export type ClaveAjuste = keyof typeof ESQUEMAS_AJUSTE;
export const CLAVES_AJUSTE = Object.keys(ESQUEMAS_AJUSTE) as ClaveAjuste[];

export const ETIQUETAS_AJUSTE: Record<ClaveAjuste, string> = {
  contacto: 'Datos de contacto y redes',
  horarios: 'Horarios de entrada y salida',
  servicio_desayuno: 'Desayuno',
  servicio_parqueadero: 'Parqueadero',
  servicio_wifi: 'Wi-Fi',
  restaurante: 'Restaurante y pizzería',
  politicas: 'Políticas del hotel',
  tarifas: 'Tarifas (informativas)',
  tratamiento_datos: 'Responsable del tratamiento de datos',
};

export const claveAjusteParamSchema = z.strictObject({ clave: z.enum(CLAVES_AJUSTE) });

export const guardarAjusteSchema = z
  .strictObject({
    valor: z.record(z.string(), z.unknown()),
    confirmado: z.boolean(),
    publicado: z.boolean(),
  })
  .refine((d) => !d.publicado || d.confirmado, {
    message: 'Solo se puede publicar un dato confirmado por la administración',
    path: ['publicado'],
  });
export type GuardarAjusteInput = z.infer<typeof guardarAjusteSchema>;

export function validarValorAjuste(clave: ClaveAjuste, valor: unknown) {
  return ESQUEMAS_AJUSTE[clave].parse(valor);
}
