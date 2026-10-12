import { Router } from 'express';
import { docsHabilitados } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { sinCache } from '../middlewares/sinCache.js';
import { requireUsuario } from '../middlewares/auth.js';
import { publicoRouter } from './publico.routes.js';
import { authRouter } from './auth.routes.js';
import { reservasRouter } from './reservas.routes.js';
import { bloqueosRouter, disponibilidadRouter, habitacionesRouter } from './habitaciones.routes.js';
import {
  auditoriaRouter,
  configuracionRouter,
  huespedesRouter,
  rolesRouter,
  tableroRouter,
  usuariosRouter,
} from './administracion.routes.js';
import { docsRouter } from './docs.routes.js';

export const apiRouter = Router();

// Liveness y readiness (las usa el healthcheck de Docker)
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
apiRouter.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

if (docsHabilitados) apiRouter.use('/docs', docsRouter);

apiRouter.use('/publico', publicoRouter);
apiRouter.use('/auth', sinCache, authRouter);

// Panel administrativo: todo exige sesión del personal y nada se guarda en caché.
// Cada ruta exige además su permiso (requirePermiso) en el router correspondiente.
const admin = Router();
admin.use(sinCache, requireUsuario);
admin.use('/tablero', tableroRouter);
admin.use('/reservas', reservasRouter);
admin.use('/habitaciones', habitacionesRouter);
admin.use('/bloqueos', bloqueosRouter);
admin.use('/disponibilidad', disponibilidadRouter);
admin.use('/huespedes', huespedesRouter);
admin.use('/configuracion', configuracionRouter);
admin.use('/usuarios', usuariosRouter);
admin.use('/roles', rolesRouter);
admin.use('/auditoria', auditoriaRouter);
apiRouter.use('/admin', admin);
