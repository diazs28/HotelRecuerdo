import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env, isProduction } from '../config/env.js';

// La sesión se fija en UTC: Prisma calcula now()/@updatedAt en Node y los envía sin zona horaria;
// con UTC las columnas TIMESTAMPTZ quedan siempre correctas. Las fechas de calendario del hotel
// (entrada, salida, bloqueos) son DATE y se interpretan en America/Bogota (src/domain/fechas.ts).
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, options: '-c TimeZone=UTC' });

export const prisma = new PrismaClient({
  adapter,
  // En pruebas no se registra nada: los conflictos esperados (409) ensuciarían la salida
  log: env.NODE_ENV === 'test' ? [] : isProduction ? ['error'] : ['warn', 'error'],
});

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
