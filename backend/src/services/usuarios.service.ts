// Autenticación del personal, usuarios y roles con permisos configurables.

import type { Prisma } from '../generated/prisma/client.js';
import { esUnicoRepetido } from '../utils/erroresBd.js';
import { prisma } from '../lib/prisma.js';
import { firmarToken } from '../lib/jwt.js';
import { hashPassword, necesitaRehash, verificarCredencial } from '../lib/password.js';
import { AppError } from '../utils/AppError.js';
import {
  PERMISOS,
  PERMISO_INDISPENSABLE_ADMIN,
  ROL_ADMINISTRADOR,
  esCodigoPermiso,
} from '../domain/permisos.js';
import type {
  ActualizarUsuarioInput,
  CambiarPasswordInput,
  CrearUsuarioInput,
  LoginInput,
  PermisosRolInput,
} from '../schemas/administracion.schema.js';
import { registrarAuditoria } from './auditoria.service.js';

const usuarioSelect = {
  id: true,
  nombre: true,
  email: true,
  activo: true,
  ultimoAcceso: true,
  createdAt: true,
  rol: { select: { id: true, codigo: true, nombre: true } },
} as const satisfies Prisma.UsuarioSelect;

const credencialesInvalidas = () =>
  new AppError(401, 'Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');

async function permisosDe(usuarioId: string): Promise<string[]> {
  const filas = await prisma.rolPermiso.findMany({
    where: { rol: { usuarios: { some: { id: usuarioId } } } },
    select: { permiso: { select: { codigo: true } } },
  });
  return filas
    .map((f) => f.permiso.codigo)
    .filter(esCodigoPermiso)
    .sort();
}

export async function perfil(usuarioId: string) {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: usuarioSelect });
  if (!u) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');
  return { ...u, permisos: await permisosDe(usuarioId) };
}

// ---------- Sesión ----------

export async function login({ email, password }: LoginInput) {
  const u = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, activo: true, versionToken: true },
  });
  // Mismo tiempo y mismo error si no existe, si la contraseña falla o si está inactivo
  const valida = await verificarCredencial(u?.passwordHash ?? null, password);
  if (!u || !valida || !u.activo) throw credencialesInvalidas();

  await prisma.usuario.update({
    where: { id: u.id },
    data: {
      ultimoAcceso: new Date(),
      ...(necesitaRehash(u.passwordHash) ? { passwordHash: await hashPassword(password) } : {}),
    },
  });
  const token = firmarToken(u.id, u.versionToken);
  return {
    token: token.token,
    tokenType: 'Bearer' as const,
    expiraEn: token.expiraEn,
    usuario: await perfil(u.id),
  };
}

// Invalida todos los tokens del usuario emitidos hasta ahora
export async function logout(usuarioId: string): Promise<void> {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { versionToken: { increment: 1 } },
  });
}

export async function cambiarPassword(usuarioId: string, datos: CambiarPasswordInput) {
  const actual = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { passwordHash: true },
  });
  if (!actual) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');
  // 400 y no 401: la persona sí está autenticada (un 401 cerraría su sesión)
  if (!(await verificarCredencial(actual.passwordHash, datos.passwordActual))) {
    throw new AppError(400, 'La contraseña actual no es correcta', 'INVALID_PASSWORD', [
      { path: 'passwordActual', message: 'La contraseña actual no es correcta' },
    ]);
  }
  const u = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      passwordHash: await hashPassword(datos.passwordNueva),
      versionToken: { increment: 1 },
    },
    select: { versionToken: true },
  });
  const token = firmarToken(usuarioId, u.versionToken);
  return { token: token.token, tokenType: 'Bearer' as const, expiraEn: token.expiraEn };
}

// ---------- Usuarios ----------

export function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    select: usuarioSelect,
  });
}

const emailRepetido = () =>
  new AppError(409, 'Ya existe un usuario con ese correo', 'EMAIL_REPETIDO', [
    { path: 'email', message: 'Usa otro correo' },
  ]);

async function validarRol(rolId: string): Promise<void> {
  const rol = await prisma.rol.findUnique({ where: { id: rolId }, select: { id: true } });
  if (!rol) {
    throw new AppError(422, 'El rol no existe', 'ROL_INVALIDO', [
      { path: 'rolId', message: 'Selecciona un rol' },
    ]);
  }
}

export async function crearUsuario(datos: CrearUsuarioInput, usuarioId: string) {
  await validarRol(datos.rolId);
  const passwordHash = await hashPassword(datos.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: { nombre: datos.nombre, email: datos.email, rolId: datos.rolId, passwordHash },
        select: usuarioSelect,
      });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'usuario.creado',
        entidad: 'usuario',
        entidadId: u.id,
        datos: { rol: u.rol.codigo },
      });
      return u;
    });
  } catch (err) {
    if (esUnicoRepetido(err)) {
      throw emailRepetido();
    }
    throw err;
  }
}

export async function actualizarUsuario(
  id: string,
  datos: ActualizarUsuarioInput,
  usuarioId: string,
) {
  const actual = await prisma.usuario.findUnique({
    where: { id },
    select: { rol: { select: { codigo: true } }, activo: true },
  });
  if (!actual) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');
  if (datos.rolId) await validarRol(datos.rolId);

  const { password, ...resto } = datos;
  const rolNuevo = datos.rolId
    ? await prisma.rol.findUnique({ where: { id: datos.rolId }, select: { codigo: true } })
    : null;
  const pierdeAdmin =
    actual.rol.codigo === ROL_ADMINISTRADOR &&
    (datos.activo === false || (rolNuevo !== null && rolNuevo.codigo !== ROL_ADMINISTRADOR));

  return prisma.$transaction(async (tx) => {
    if (pierdeAdmin) {
      // Un solo cambio de administradores a la vez: dos personas no pueden desactivarse mutuamente
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ultimo-administrador'))`;
      const otros = await tx.usuario.count({
        where: { id: { not: id }, activo: true, rol: { codigo: ROL_ADMINISTRADOR } },
      });
      if (otros === 0) {
        throw new AppError(
          409,
          'Debe quedar al menos un administrador activo',
          'ULTIMO_ADMINISTRADOR',
        );
      }
    }
    const u = await tx.usuario.update({
      where: { id },
      data: {
        ...resto,
        // Restablecer contraseña, desactivar o cambiar el rol cierra las sesiones abiertas
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
        ...(password || datos.activo === false || datos.rolId
          ? { versionToken: { increment: 1 } }
          : {}),
      },
      select: usuarioSelect,
    });
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'usuario.actualizado',
      entidad: 'usuario',
      entidadId: id,
      datos: { campos: Object.keys(datos) },
    });
    return u;
  });
}

// ---------- Roles ----------

export async function listarRoles() {
  const roles = await prisma.rol.findMany({
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      descripcion: true,
      permisos: { select: { permiso: { select: { codigo: true } } } },
      _count: { select: { usuarios: true } },
    },
  });
  return {
    catalogo: Object.entries(PERMISOS).map(([codigo, descripcion]) => ({ codigo, descripcion })),
    roles: roles.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      usuarios: r._count.usuarios,
      permisos: r.permisos.map((p) => p.permiso.codigo).sort(),
    })),
  };
}

export async function actualizarPermisosRol(
  rolId: string,
  { permisos }: PermisosRolInput,
  usuarioId: string,
) {
  const rol = await prisma.rol.findUnique({ where: { id: rolId }, select: { codigo: true } });
  if (!rol) throw new AppError(404, 'Rol no encontrado', 'NOT_FOUND');
  if (rol.codigo === ROL_ADMINISTRADOR && !permisos.includes(PERMISO_INDISPENSABLE_ADMIN)) {
    throw new AppError(
      409,
      'El rol administrador no puede perder la gestión de usuarios (se perdería el acceso)',
      'PERMISO_INDISPENSABLE',
    );
  }
  const codigos = [...new Set(permisos)];
  await prisma.$transaction(async (tx) => {
    const filas = await tx.permiso.findMany({
      where: { codigo: { in: codigos } },
      select: { id: true },
    });
    await tx.rolPermiso.deleteMany({ where: { rolId } });
    await tx.rolPermiso.createMany({ data: filas.map((p) => ({ rolId, permisoId: p.id })) });
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'rol.permisos',
      entidad: 'rol',
      entidadId: rolId,
      datos: { permisos: codigos },
    });
  });
  return (await listarRoles()).roles.find((r) => r.id === rolId);
}
