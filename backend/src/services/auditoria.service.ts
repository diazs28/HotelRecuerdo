import type { Prisma } from '../generated/prisma/client.js';
import { prisma, type Tx } from '../lib/prisma.js';

export type EntidadAuditada =
  | 'reserva'
  | 'habitacion'
  | 'cama'
  | 'bloqueo'
  | 'huesped'
  | 'ajuste'
  | 'tipo_habitacion'
  | 'canal'
  | 'usuario'
  | 'rol';

export interface RegistroAuditoria {
  usuarioId: string | null;
  accion: string;
  entidad: EntidadAuditada;
  entidadId: string;
  // Solo lo mínimo (estados, fechas, ids). NUNCA datos personales del huésped.
  datos?: Prisma.InputJsonValue;
}

// Se llama DENTRO de la transacción de la operación: si la operación falla, no queda registro;
// si el registro falla, la operación se revierte.
export async function registrarAuditoria(tx: Tx, registro: RegistroAuditoria): Promise<void> {
  await tx.auditoria.create({
    data: {
      usuarioId: registro.usuarioId,
      accion: registro.accion,
      entidad: registro.entidad,
      entidadId: registro.entidadId,
      ...(registro.datos !== undefined ? { datos: registro.datos } : {}),
    },
  });
}

const seleccion = {
  id: true,
  accion: true,
  entidad: true,
  entidadId: true,
  datos: true,
  createdAt: true,
  usuario: { select: { id: true, nombre: true } },
} as const;

export function historialDe(entidad: EntidadAuditada, entidadId: string) {
  return prisma.auditoria.findMany({
    where: { entidad, entidadId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: seleccion,
  });
}

export async function listarAuditoria(filtros: {
  entidad?: string;
  entidadId?: string;
  usuarioId?: string;
  pagina: number;
  porPagina: number;
}) {
  const where: Prisma.AuditoriaWhereInput = {
    ...(filtros.entidad ? { entidad: filtros.entidad } : {}),
    ...(filtros.entidadId ? { entidadId: filtros.entidadId } : {}),
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
  };
  const [total, registros] = await prisma.$transaction([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
      select: seleccion,
    }),
  ]);
  return { total, pagina: filtros.pagina, porPagina: filtros.porPagina, registros };
}
