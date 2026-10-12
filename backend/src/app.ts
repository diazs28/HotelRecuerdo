import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env, trustProxy } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { limitador } from './middlewares/rateLimit.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  app.use(
    pinoHttp({
      logger,
      // Registro mínimo de cada petición: sin cabeceras (tokens) ni cuerpo (datos personales).
      // La URL se registra sin query string (puede llevar nombres o teléfonos de una búsqueda).
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      // Solo orígenes de la lista blanca. Sin `credentials`: la sesión va en Authorization (Bearer),
      // nunca en cookies.
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    }),
  );
  app.use(
    limitador(
      'global',
      {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_MAX,
        skip: (req) => req.path.startsWith('/api/health'),
        message: {
          error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta más tarde' },
        },
      },
      // Si la BD no responde, el límite global deja pasar: /api/health debe seguir respondiendo
      true,
    ),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
