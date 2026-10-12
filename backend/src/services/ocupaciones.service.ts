// ÚNICO servicio que crea, mueve o libera ocupaciones de camas (reservas y bloqueos).
// La garantía contra la sobreventa es la restricción de exclusión ocupaciones_cama_sin_cruce de
// PostgreSQL (docs/adr/0002): este servicio solo traduce su error a un 409 con el detalle útil.

import { Prisma } from '../generated/prisma/client.js';
import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { esViolacionExclusion } from '../utils/erroresBd.js';
import { aFechaBd, deFechaBd } from '../domain/fechas.js';
import { codigoReserva } from '../domain/estadosReserva.js';

export async function crearOcupacionesReserva(
  tx: Tx,
  reservaId: string,
  camaIds: readonly string[],
  entrada: string,
  salida: string,
): Promise<void> {
  if (camaIds.length === 0) return;
  await tx.ocupacion.createMany({
    data: camaIds.map((camaId) => ({
      camaId,
      tipo: 'RESERVA' as const,
      reservaId,
      fechaInicio: aFechaBd(entrada),
      fechaFin: aFechaBd(salida),
    })),
  });
}

// Cambia las noches de todas las ocupaciones activas de la reserva (cambio de fechas o salida
// anticipada). Si alguna cama ya está tomada en las nuevas noches, la base de datos lo rechaza.
export async function moverOcupacionesReserva(
  tx: Tx,
  reservaId: string,
  entrada: string,
  salida: string,
): Promise<void> {
  await tx.ocupacion.updateMany({
    where: { reservaId, activa: true },
    data: { fechaInicio: aFechaBd(entrada), fechaFin: aFechaBd(salida) },
  });
}

export async function liberarOcupacionesReserva(
  tx: Tx,
  reservaId: string,
  camaIds?: readonly string[],
): Promise<number> {
  const r = await tx.ocupacion.updateMany({
    where: { reservaId, activa: true, ...(camaIds ? { camaId: { in: [...camaIds] } } : {}) },
    data: { activa: false, liberadaEn: new Date() },
  });
  return r.count;
}

export async function crearOcupacionesBloqueo(
  tx: Tx,
  bloqueoId: string,
  camaIds: readonly string[],
  inicio: string,
  fin: string | null,
): Promise<void> {
  if (camaIds.length === 0) return;
  await tx.ocupacion.createMany({
    data: camaIds.map((camaId) => ({
      camaId,
      tipo: 'BLOQUEO' as const,
      bloqueoId,
      fechaInicio: aFechaBd(inicio),
      fechaFin: fin === null ? null : aFechaBd(fin),
    })),
  });
}

export interface ConflictoCama {
  camaId: string;
  cama: string;
  habitacion: string;
  desde: string;
  hasta: string | null;
  motivo: 'RESERVA' | 'BLOQUEO' | 'MANTENIMIENTO';
  // Solo el código: el detalle del conflicto no expone datos del huésped
  reservaCodigo: string | null;
}

// Ocupaciones activas que se cruzan con [inicio, fin) en las camas indicadas
export async function buscarConflictos(
  camaIds: readonly string[],
  inicio: string,
  fin: string | null,
  excluir: { reservaId?: string; bloqueoId?: string } = {},
): Promise<ConflictoCama[]> {
  if (camaIds.length === 0) return [];
  const filas = await prisma.ocupacion.findMany({
    where: {
      camaId: { in: [...camaIds] },
      activa: true,
      ...(fin === null ? {} : { fechaInicio: { lt: aFechaBd(fin) } }),
      AND: [
        { OR: [{ fechaFin: null }, { fechaFin: { gt: aFechaBd(inicio) } }] },
        // En SQL "reserva_id <> X" descarta las filas con NULL: se incluyen explícitamente
        ...(excluir.reservaId
          ? [{ OR: [{ reservaId: null }, { reservaId: { not: excluir.reservaId } }] }]
          : []),
        ...(excluir.bloqueoId
          ? [{ OR: [{ bloqueoId: null }, { bloqueoId: { not: excluir.bloqueoId } }] }]
          : []),
      ],
    },
    orderBy: { fechaInicio: 'asc' },
    select: {
      camaId: true,
      fechaInicio: true,
      fechaFin: true,
      tipo: true,
      cama: { select: { identificador: true, habitacion: { select: { numero: true } } } },
      reserva: { select: { numero: true } },
      bloqueo: { select: { tipo: true } },
    },
  });
  return filas.map((f) => ({
    camaId: f.camaId,
    cama: f.cama.identificador,
    habitacion: f.cama.habitacion.numero,
    desde: deFechaBd(f.fechaInicio),
    hasta: f.fechaFin ? deFechaBd(f.fechaFin) : null,
    motivo: f.tipo === 'RESERVA' ? 'RESERVA' : (f.bloqueo?.tipo ?? 'BLOQUEO'),
    reservaCodigo: f.reserva ? codigoReserva(f.reserva.numero) : null,
  }));
}

function describirConflicto(c: ConflictoCama): string {
  const quien =
    c.motivo === 'RESERVA'
      ? `reserva ${c.reservaCodigo ?? ''}`.trim()
      : c.motivo === 'MANTENIMIENTO'
        ? 'mantenimiento'
        : 'bloqueo';
  const hasta = c.hasta ? `hasta el ${c.hasta}` : 'sin fecha de fin';
  return `Habitación ${c.habitacion}, cama ${c.cama}: ${quien} desde el ${c.desde} ${hasta}`;
}

export function errorCamaNoDisponible(conflictos: readonly ConflictoCama[]): AppError {
  return new AppError(
    409,
    conflictos.length > 0
      ? 'Una o más camas ya están ocupadas o bloqueadas en esas fechas'
      : 'Las camas cambiaron mientras se guardaba; vuelve a consultar la disponibilidad',
    'CAMA_NO_DISPONIBLE',
    conflictos.map((c) => ({ path: 'camas', message: describirConflicto(c), ...c })),
  );
}

// Ejecuta una operación que crea o mueve ocupaciones. Si PostgreSQL rechaza un cruce, responde 409
// con las camas en conflicto (consultadas después del rollback, fuera de la transacción fallida).
export async function conControlDeCruces<T>(
  operacion: () => Promise<T>,
  contexto: {
    camaIds: () => Promise<readonly string[]> | readonly string[];
    inicio: string;
    fin: string | null;
    excluir?: { reservaId?: string; bloqueoId?: string };
  },
): Promise<T> {
  try {
    return await operacion();
  } catch (err) {
    if (!esViolacionExclusion(err)) throw err;
    const conflictos = await buscarConflictos(
      await contexto.camaIds(),
      contexto.inicio,
      contexto.fin,
      contexto.excluir,
    );
    throw errorCamaNoDisponible(conflictos);
  }
}

// Bloquea la fila de la reserva durante la transacción: serializa los cambios sobre una misma
// reserva (estado, fechas, camas) hechos por dos personas a la vez.
export async function bloquearReserva(tx: Tx, reservaId: string): Promise<void> {
  const filas = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM reservas WHERE id = ${reservaId}::uuid FOR UPDATE`,
  );
  if (filas.length === 0) throw new AppError(404, 'Reserva no encontrada', 'NOT_FOUND');
}
