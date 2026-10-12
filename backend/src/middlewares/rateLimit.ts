import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AlmacenLimitesPg } from '../lib/almacenLimites.js';

const mensaje = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Demasiados intentos, espera unos minutos e inténtalo de nuevo',
  },
};

export function claveIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'desconocida');
}

// Contadores en PostgreSQL (persistentes y compartidos entre instancias). `nombre` es el prefijo de
// sus claves. `abiertoSiFallaLaBd`: si la BD no responde, deja pasar (solo el límite global, para
// no tumbar /api/health) o responde error (login y formulario público).
export function limitador(
  nombre: string,
  opciones: Partial<Options> & Pick<Options, 'windowMs' | 'limit'>,
  abiertoSiFallaLaBd = false,
) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: mensaje,
    keyGenerator: claveIp,
    ...opciones,
    store: new AlmacenLimitesPg(nombre),
    passOnStoreError: abiertoSiFallaLaBd,
  });
}

function emailDelCuerpo(req: Request): string {
  const valor: unknown = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof valor === 'string' ? valor.trim().toLowerCase().slice(0, 255) : '';
}

// Login: intentos FALLIDOS por IP + correo, y un tope por IP (frena probar muchas cuentas)
export function crearLimitesLogin() {
  return [
    limitador('login-ip', {
      windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
      limit: env.AUTH_RATE_LIMIT_MAX * 4,
      skipSuccessfulRequests: true,
    }),
    limitador('login-email', {
      windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
      limit: env.AUTH_RATE_LIMIT_MAX,
      keyGenerator: (req) => `${claveIp(req)}|${emailDelCuerpo(req)}`,
      skipSuccessfulRequests: true,
    }),
    // Tope por cuenta desde cualquier IP (frena ataques distribuidos contra una sola cuenta).
    // Más alto que el de IP + cuenta para que un tercero no pueda bloquear fácilmente al personal.
    limitador('login-cuenta', {
      windowMs: 60 * 60 * 1000,
      limit: env.AUTH_RATE_LIMIT_MAX * 4,
      keyGenerator: (req) => `cuenta|${emailDelCuerpo(req)}`,
      skipSuccessfulRequests: true,
    }),
  ];
}

// Cambio de contraseña: intentos fallidos por usuario autenticado
export function crearLimitePassword() {
  return limitador('password', {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    keyGenerator: (req) => `usuario:${req.usuario?.id ?? claveIp(req)}`,
    skipSuccessfulRequests: true,
  });
}

// Formulario público: solicitudes por IP (todas cuentan, también las correctas)
export function crearLimiteSolicitudes() {
  return limitador('solicitudes', {
    windowMs: env.SOLICITUDES_RATE_LIMIT_WINDOW_MS,
    limit: env.SOLICITUDES_RATE_LIMIT_MAX,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message:
          'Recibimos varias solicitudes desde tu conexión. Espera un rato o comunícate directamente con el hotel.',
      },
    },
  });
}

export function crearLimiteDisponibilidad() {
  return limitador('disponibilidad', {
    windowMs: 15 * 60 * 1000,
    limit: env.DISPONIBILIDAD_RATE_LIMIT_MAX,
  });
}
