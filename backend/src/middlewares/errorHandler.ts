import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { esViolacionExclusion } from '../utils/erroresBd.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
};

// Nunca se envían stack traces, mensajes internos ni nombres de tablas al cliente
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  // Red de seguridad: una ocupación que se cruza y no fue traducida por el servicio
  if (esViolacionExclusion(err)) {
    res.status(409).json({
      error: {
        code: 'CAMA_NO_DISPONIBLE',
        message: 'Una o más camas ya están ocupadas o bloqueadas en esas fechas',
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'El registro entra en conflicto con otro existente' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'El registro está en uso por otros registros' },
      });
      return;
    }
  }

  // Errores de body-parser: JSON mal formado o body demasiado grande
  const tipo = (err as { type?: unknown } | null)?.type;
  if (tipo === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON mal formado' } });
    return;
  }
  if (tipo === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Solicitud demasiado grande' } });
    return;
  }

  logger.error({ err }, 'Error no controlado');
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
};
