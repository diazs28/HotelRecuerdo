import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

// Trata las variables vacías (ej. `SEED_ADMIN_EMAIL=`) como no definidas
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional(),
  );

const urlPostgres = (nombre: string) =>
  z
    .string()
    .min(1, `${nombre} es obligatoria`)
    .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
      message: `${nombre} debe ser una URL de PostgreSQL`,
    });

const enteroPositivo = (porDefecto: number) =>
  z.coerce.number().int().positive().default(porDefecto);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: urlPostgres('DATABASE_URL'),
    // Solo la usa Prisma CLI (prisma.config.ts) para migrar con un rol dueño de las tablas
    MIGRATION_DATABASE_URL: opcional(urlPostgres('MIGRATION_DATABASE_URL')),
    // Base SOLO para pruebas de integración (npm test). Debe ser distinta de DATABASE_URL.
    TEST_DATABASE_URL: opcional(urlPostgres('TEST_DATABASE_URL')),

    // Lista separada por comas de orígenes permitidos (ej. http://localhost:5173)
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),

    // Proxies inversos de confianza delante de la API (Express "trust proxy"). 0 = conexión directa.
    // Sin definir: 0 en desarrollo; OBLIGATORIA en producción.
    TRUST_PROXY: opcional(z.coerce.number().int().min(0).max(10)),

    RATE_LIMIT_WINDOW_MS: enteroPositivo(15 * 60 * 1000),
    RATE_LIMIT_MAX: enteroPositivo(600),

    // Sesiones del personal (JWT HS256)
    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_ISSUER: z.string().trim().min(1).default('hotel-el-recuerdo-api'),
    JWT_TTL_MIN: z.coerce.number().int().min(5).max(720).default(480),

    // Login: intentos FALLIDOS por IP + email en la ventana
    AUTH_RATE_LIMIT_WINDOW_MS: enteroPositivo(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: enteroPositivo(5),

    // Formulario público: solicitudes por IP en la ventana (protección contra abuso)
    SOLICITUDES_RATE_LIMIT_WINDOW_MS: enteroPositivo(60 * 60 * 1000),
    SOLICITUDES_RATE_LIMIT_MAX: enteroPositivo(5),
    // Consultas públicas de disponibilidad por IP en la ventana
    DISPONIBILIDAD_RATE_LIMIT_MAX: enteroPositivo(60),

    // Swagger UI en /api/docs. Por defecto: activo fuera de producción.
    API_DOCS_ENABLED: opcional(z.enum(['true', 'false']).transform((v) => v === 'true')),

    // Seed y creación del primer administrador (opcionales para el servidor)
    SEED_ADMIN_NOMBRE: opcional(z.string().trim().min(2).max(150)),
    SEED_ADMIN_EMAIL: opcional(
      z.string().trim().toLowerCase().pipe(z.email('Debe ser un email válido')),
    ),
    SEED_ADMIN_PASSWORD: opcional(
      z.string().min(12, 'SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres').max(128),
    ),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    // Sin valor por defecto en producción: un 0 detrás de un proxy haría que todos los visitantes
    // compartan la IP del proxy; un número mayor sin proxy real permitiría falsificar la IP.
    if (e.TRUST_PROXY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message:
          'es obligatoria en producción: 0 sin proxy delante de la API, o el número de proxies',
      });
    }
    if (e.TEST_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_URL'],
        message: 'no debe definirse en producción',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

// Devuelve los errores SOLO con el nombre de la variable y el motivo, nunca su valor
export function erroresDeEnv(valores: Record<string, string | undefined>): string[] {
  const r = envSchema.safeParse(valores);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Configuración de entorno inválida:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const docsHabilitados = env.API_DOCS_ENABLED ?? !isProduction;
export const trustProxy = env.TRUST_PROXY ?? 0;
