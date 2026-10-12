import type { Request, RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import { verificarToken } from '../lib/jwt.js';
import { AppError } from '../utils/AppError.js';
import { esCodigoPermiso, type CodigoPermiso } from '../domain/permisos.js';

const JWT_REGEX = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

const tokenInvalido = () => new AppError(401, 'Token inválido o expirado', 'INVALID_TOKEN');

function extraerBearer(req: Request): string {
  const cabecera = req.headers.authorization;
  const token = cabecera ? JWT_REGEX.exec(cabecera)?.[1] : undefined;
  if (!token) throw new AppError(401, 'Autenticación requerida', 'UNAUTHORIZED');
  return token;
}

// Exige un usuario del personal activo con un token vigente. Carga sus permisos en cada petición:
// un cambio de rol o de permisos se aplica de inmediato.
export const requireUsuario: RequestHandler = async (req, _res, next) => {
  const payload = verificarToken(extraerBearer(req));
  if (!payload) throw tokenInvalido();

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      activo: true,
      versionToken: true,
      rol: {
        select: { codigo: true, permisos: { select: { permiso: { select: { codigo: true } } } } },
      },
    },
  });
  // Usuario borrado o token emitido antes de un cierre de sesión / cambio de contraseña
  if (!usuario || usuario.versionToken !== payload.ver) throw tokenInvalido();
  if (!usuario.activo) throw new AppError(403, 'La cuenta está inactiva', 'ACCOUNT_DISABLED');

  const permisos = new Set<CodigoPermiso>();
  for (const { permiso } of usuario.rol.permisos) {
    if (esCodigoPermiso(permiso.codigo)) permisos.add(permiso.codigo);
  }
  req.usuario = { id: usuario.id, rolCodigo: usuario.rol.codigo, permisos };
  next();
};

// Va después de requireUsuario. Basta con tener UNO de los permisos indicados.
export function requirePermiso(...requeridos: CodigoPermiso[]): RequestHandler {
  return (req, _res, next) => {
    const permisos = req.usuario?.permisos;
    if (!permisos || !requeridos.some((p) => permisos.has(p))) {
      throw new AppError(403, 'No tienes permiso para realizar esta acción', 'FORBIDDEN');
    }
    next();
  };
}

export function tienePermiso(req: Request, permiso: CodigoPermiso): boolean {
  return req.usuario?.permisos.has(permiso) ?? false;
}

// Usuario autenticado (para rutas que ya pasaron por requireUsuario)
export function usuarioDe(req: Request): NonNullable<Request['usuario']> {
  if (!req.usuario) throw new AppError(401, 'Autenticación requerida', 'UNAUTHORIZED');
  return req.usuario;
}
