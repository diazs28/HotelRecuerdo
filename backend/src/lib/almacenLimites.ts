import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { prisma } from './prisma.js';

// Almacén de rate limiting en PostgreSQL (tabla limites_tasa): los contadores sobreviven a un
// reinicio y se comparten entre todas las instancias de la API, sin Redis.
// Cada limitador usa un prefijo propio para que sus claves no se mezclen.
//
// increment es UNA sentencia atómica (INSERT … ON CONFLICT DO UPDATE): dos peticiones simultáneas
// de la misma clave nunca leen el mismo valor. Si la ventana ya venció, el contador se reinicia.
export class AlmacenLimitesPg implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;

  constructor(prefijo: string) {
    this.prefix = `${prefijo}:`;
  }

  init(opciones: Options): void {
    this.windowMs = opciones.windowMs;
  }

  private clave(key: string): string {
    // La clave puede incluir el email (login): se recorta para no exceder la columna
    return `${this.prefix}${key}`.slice(0, 300);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const filas = await prisma.$queryRaw<Array<{ hits: number; reinicio: Date }>>`
      INSERT INTO limites_tasa (clave, hits, reinicio)
      VALUES (${this.clave(key)}, 1, now() + ${this.windowMs} * interval '1 millisecond')
      ON CONFLICT (clave) DO UPDATE SET
        hits = CASE WHEN limites_tasa.reinicio <= now() THEN 1 ELSE limites_tasa.hits + 1 END,
        reinicio = CASE WHEN limites_tasa.reinicio <= now()
                        THEN now() + ${this.windowMs} * interval '1 millisecond'
                        ELSE limites_tasa.reinicio END
      RETURNING hits, reinicio`;
    const fila = filas[0]!;
    return { totalHits: Number(fila.hits), resetTime: fila.reinicio };
  }

  // Lo usa skipSuccessfulRequests (login): un intento correcto no cuenta
  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE limites_tasa SET hits = GREATEST(hits - 1, 0)
      WHERE clave = ${this.clave(key)} AND reinicio > now()`;
  }

  async resetKey(key: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM limites_tasa WHERE clave = ${this.clave(key)}`;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const filas = await prisma.$queryRaw<Array<{ hits: number; reinicio: Date }>>`
      SELECT hits, reinicio FROM limites_tasa WHERE clave = ${this.clave(key)} AND reinicio > now()`;
    const fila = filas[0];
    return fila ? { totalHits: Number(fila.hits), resetTime: fila.reinicio } : undefined;
  }
}

// Borra contadores vencidos (la tarea periódica lo llama; no afecta a ventanas vigentes)
export async function limpiarLimitesVencidos(): Promise<number> {
  return prisma.$executeRaw`DELETE FROM limites_tasa WHERE reinicio < now() - interval '1 hour'`;
}
