import { pino } from 'pino';
import { env } from '../config/env.js';

// Los logs nunca deben contener tokens, contraseñas ni datos personales de huéspedes.
// Si alguno aparece por error dentro de un objeto registrado, se oculta.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.passwordActual',
      '*.passwordNueva',
      '*.token',
      '*.email',
      '*.telefono',
      '*.nombres',
      '*.apellidos',
      '*.numeroDocumento',
    ],
    censor: '[REDACTED]',
  },
});
