import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';

// JWT HS256 implementado con node:crypto (sin dependencias externas).
// - Solo se acepta la cabecera exacta {"alg":"HS256","typ":"JWT"}: nunca "none" ni otros algoritmos.
// - La firma se compara en tiempo constante.
// - "ver" (versión de token) permite invalidar todas las sesiones de un usuario.

const AUDIENCIA = 'personal';
const CABECERA = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const MAX_LONGITUD_TOKEN = 2048;
const MARGEN_RELOJ_SEG = 5;

const payloadSchema = z.object({
  sub: z.uuid(),
  aud: z.literal(AUDIENCIA),
  iss: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.uuid(),
  ver: z.number().int().min(0),
});

export type TokenPayload = z.infer<typeof payloadSchema>;

function base64url(texto: string | Buffer): string {
  return Buffer.from(texto).toString('base64url');
}

function firmar(datos: string): Buffer {
  return createHmac('sha256', env.JWT_SECRET).update(datos).digest();
}

export function firmarToken(
  usuarioId: string,
  versionToken: number,
): { token: string; expiraEn: Date } {
  const ahora = Math.floor(Date.now() / 1000);
  const exp = ahora + env.JWT_TTL_MIN * 60;
  const payload: TokenPayload = {
    sub: usuarioId,
    aud: AUDIENCIA,
    iss: env.JWT_ISSUER,
    iat: ahora,
    exp,
    jti: randomUUID(),
    ver: versionToken,
  };
  const datos = `${CABECERA}.${base64url(JSON.stringify(payload))}`;
  return {
    token: `${datos}.${firmar(datos).toString('base64url')}`,
    expiraEn: new Date(exp * 1000),
  };
}

// Devuelve el payload si el token es válido; null en cualquier otro caso
export function verificarToken(token: string): TokenPayload | null {
  if (token.length > MAX_LONGITUD_TOKEN) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecera, cuerpo, firmaRecibida] = partes as [string, string, string];
  if (cabecera !== CABECERA) return null;

  const esperada = firmar(`${cabecera}.${cuerpo}`);
  const recibida = Buffer.from(firmaRecibida, 'base64url');
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return null;
  const payload = parsed.data;

  const ahora = Math.floor(Date.now() / 1000);
  if (payload.iss !== env.JWT_ISSUER) return null;
  if (payload.exp <= ahora - MARGEN_RELOJ_SEG) return null;
  if (payload.iat > ahora + MARGEN_RELOJ_SEG) return null;
  return payload;
}
