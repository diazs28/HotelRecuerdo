import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { limpiarLimitesVencidos } from './lib/almacenLimites.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Limpieza periódica de contadores de rate limit vencidos (cada hora)
const limpieza = setInterval(
  () => {
    limpiarLimitesVencidos().catch((err: unknown) => {
      logger.warn({ err }, 'No se pudieron limpiar los límites vencidos');
    });
  },
  60 * 60 * 1000,
);
limpieza.unref();

function shutdown(signal: string) {
  logger.info(`${signal} recibido, cerrando servidor...`);
  clearInterval(limpieza);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  // Forzar la salida si el cierre tarda demasiado
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Promesa rechazada sin manejar');
});
