// Configuración del hotel: ajustes publicables, tipos de habitación y canales.

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
  CLAVES_AJUSTE,
  ETIQUETAS_AJUSTE,
  validarValorAjuste,
  type ClaveAjuste,
  type GuardarAjusteInput,
} from '../schemas/ajustes.schema.js';
import type {
  ActualizarCanalInput,
  ActualizarTipoHabitacionInput,
  CanalInput,
  TipoHabitacionInput,
} from '../schemas/administracion.schema.js';
import { registrarAuditoria } from './auditoria.service.js';

export const CANAL_WEB = 'web';

// ---------- Ajustes ----------

export async function listarAjustes() {
  const guardados = await prisma.ajuste.findMany({
    select: {
      clave: true,
      valor: true,
      confirmado: true,
      publicado: true,
      updatedAt: true,
      actualizadoPor: { select: { id: true, nombre: true } },
    },
  });
  const porClave = new Map(guardados.map((a) => [a.clave, a]));
  // Todas las claves, aunque aún no se hayan guardado (pendientes de confirmar)
  return CLAVES_AJUSTE.map((clave) => {
    const a = porClave.get(clave);
    return {
      clave,
      etiqueta: ETIQUETAS_AJUSTE[clave],
      valor: a?.valor ?? {},
      confirmado: a?.confirmado ?? false,
      publicado: a?.publicado ?? false,
      updatedAt: a?.updatedAt ?? null,
      actualizadoPor: a?.actualizadoPor ?? null,
    };
  });
}

export async function guardarAjuste(
  clave: ClaveAjuste,
  datos: GuardarAjusteInput,
  usuarioId: string,
) {
  const valor = validarValorAjuste(clave, datos.valor) as Prisma.InputJsonValue;
  await prisma.$transaction(async (tx) => {
    await tx.ajuste.upsert({
      where: { clave },
      create: {
        clave,
        valor,
        confirmado: datos.confirmado,
        publicado: datos.publicado,
        actualizadoPorId: usuarioId,
      },
      update: {
        valor,
        confirmado: datos.confirmado,
        publicado: datos.publicado,
        actualizadoPorId: usuarioId,
      },
    });
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'ajuste.guardado',
      entidad: 'ajuste',
      // La auditoría usa UUID: se deriva uno estable de la clave
      entidadId: idDeClave(clave),
      datos: { clave, confirmado: datos.confirmado, publicado: datos.publicado },
    });
  });
  return (await listarAjustes()).find((a) => a.clave === clave);
}

// UUID determinista por clave de ajuste (para relacionar la auditoría)
export function idDeClave(clave: ClaveAjuste): string {
  const indice = CLAVES_AJUSTE.indexOf(clave);
  return `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`;
}

// Solo lo confirmado y publicado (sitio público)
export async function ajustesPublicados(): Promise<Partial<Record<ClaveAjuste, unknown>>> {
  const publicados = await prisma.ajuste.findMany({
    where: { confirmado: true, publicado: true },
    select: { clave: true, valor: true },
  });
  const r: Partial<Record<ClaveAjuste, unknown>> = {};
  for (const a of publicados) {
    if ((CLAVES_AJUSTE as string[]).includes(a.clave)) r[a.clave as ClaveAjuste] = a.valor;
  }
  return r;
}

// ---------- Tipos de habitación ----------

const nombreRepetido = (que: string) =>
  new AppError(409, `Ya existe ${que} con ese nombre o código`, 'NOMBRE_REPETIDO', [
    { path: 'nombre', message: 'Usa otro nombre' },
  ]);

function esP2002(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export function listarTiposHabitacion() {
  return prisma.tipoHabitacion.findMany({
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      capacidadSugerida: true,
      publicado: true,
      activo: true,
      orden: true,
      _count: { select: { habitaciones: { where: { activa: true } } } },
    },
  });
}

export async function crearTipoHabitacion(datos: TipoHabitacionInput, usuarioId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const t = await tx.tipoHabitacion.create({ data: datos });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'tipo_habitacion.creado',
        entidad: 'tipo_habitacion',
        entidadId: t.id,
        datos: { nombre: t.nombre },
      });
      return t;
    });
  } catch (err) {
    if (esP2002(err)) throw nombreRepetido('un tipo de habitación');
    throw err;
  }
}

export async function actualizarTipoHabitacion(
  id: string,
  datos: ActualizarTipoHabitacionInput,
  usuarioId: string,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const t = await tx.tipoHabitacion.update({ where: { id }, data: datos });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'tipo_habitacion.actualizado',
        entidad: 'tipo_habitacion',
        entidadId: id,
        datos: { campos: Object.keys(datos) },
      });
      return t;
    });
  } catch (err) {
    if (esP2002(err)) throw nombreRepetido('un tipo de habitación');
    throw err;
  }
}

// ---------- Canales ----------

export function listarCanales() {
  return prisma.canal.findMany({
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, codigo: true, nombre: true, activo: true, orden: true },
  });
}

export async function crearCanal(datos: CanalInput, usuarioId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.canal.create({ data: datos });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'canal.creado',
        entidad: 'canal',
        entidadId: c.id,
        datos: { codigo: c.codigo },
      });
      return c;
    });
  } catch (err) {
    if (esP2002(err)) throw nombreRepetido('un canal');
    throw err;
  }
}

export async function actualizarCanal(id: string, datos: ActualizarCanalInput, usuarioId: string) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.canal.findUnique({ where: { id }, select: { codigo: true } });
    if (!actual) throw new AppError(404, 'Canal no encontrado', 'NOT_FOUND');
    if (actual.codigo === CANAL_WEB && datos.activo === false) {
      throw new AppError(
        409,
        'El canal "web" recibe las solicitudes del sitio y no se puede desactivar',
        'CANAL_PROTEGIDO',
      );
    }
    const c = await tx.canal.update({ where: { id }, data: datos });
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'canal.actualizado',
      entidad: 'canal',
      entidadId: id,
      datos: { campos: Object.keys(datos) },
    });
    return c;
  });
}
