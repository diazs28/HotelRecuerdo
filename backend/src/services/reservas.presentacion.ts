// Selección y forma de salida de las reservas (compartida por los servicios de reservas).

import type { Prisma } from '../generated/prisma/client.js';
import type { prisma, Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { codigoReserva } from '../domain/estadosReserva.js';
import { deFechaBd, noches } from '../domain/fechas.js';
import { presentarHuesped, type PermisosDatos } from '../domain/privacidad.js';

export const huespedSelect = {
  id: true,
  nombres: true,
  apellidos: true,
  telefono: true,
  email: true,
  tipoDocumento: true,
  numeroDocumento: true,
  anonimizadoEn: true,
} as const satisfies Prisma.HuespedSelect;

export const reservaSelect = {
  id: true,
  numero: true,
  estado: true,
  fechaEntrada: true,
  fechaSalida: true,
  cantidadHuespedes: true,
  comentarioHuesped: true,
  notasOperativas: true,
  confirmadaEn: true,
  canceladaEn: true,
  motivoCancelacion: true,
  createdAt: true,
  updatedAt: true,
  canal: { select: { id: true, codigo: true, nombre: true } },
  tipoHabitacionPreferido: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  huesped: { select: huespedSelect },
  ocupaciones: {
    where: { activa: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fechaInicio: true,
      fechaFin: true,
      cama: {
        select: {
          id: true,
          identificador: true,
          tipo: true,
          plazas: true,
          habitacion: { select: { id: true, numero: true } },
        },
      },
    },
  },
} as const satisfies Prisma.ReservaSelect;

export type ReservaBd = Prisma.ReservaGetPayload<{ select: typeof reservaSelect }>;

// Camas vigentes: las que llegan hasta la salida de la reserva. Una cama quitada a mitad de una
// estancia conserva sus noches pasadas (historial) pero ya no cuenta como asignada.
export function ocupacionesVigentes(r: Pick<ReservaBd, 'ocupaciones' | 'fechaSalida'>) {
  const salida = r.fechaSalida.getTime();
  return r.ocupaciones.filter((o) => o.fechaFin?.getTime() === salida);
}

export function plazasAsignadas(r: Pick<ReservaBd, 'ocupaciones' | 'fechaSalida'>): number {
  return ocupacionesVigentes(r).reduce((suma, o) => suma + o.cama.plazas, 0);
}

export function presentarReserva(r: ReservaBd, permisos: PermisosDatos) {
  const entrada = deFechaBd(r.fechaEntrada);
  const salida = deFechaBd(r.fechaSalida);
  return {
    id: r.id,
    codigo: codigoReserva(r.numero),
    estado: r.estado,
    fechaEntrada: entrada,
    fechaSalida: salida,
    noches: noches(entrada, salida),
    cantidadHuespedes: r.cantidadHuespedes,
    plazasAsignadas: plazasAsignadas(r),
    comentarioHuesped: r.comentarioHuesped,
    notasOperativas: r.notasOperativas,
    confirmadaEn: r.confirmadaEn,
    canceladaEn: r.canceladaEn,
    motivoCancelacion: r.motivoCancelacion,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    canal: r.canal,
    tipoHabitacionPreferido: r.tipoHabitacionPreferido,
    responsable: r.responsable,
    creadoPor: r.creadoPor,
    huesped: presentarHuesped(r.huesped, permisos),
    camas: ocupacionesVigentes(r).map((o) => ({
      ocupacionId: o.id,
      camaId: o.cama.id,
      identificador: o.cama.identificador,
      tipo: o.cama.tipo,
      plazas: o.cama.plazas,
      habitacionId: o.cama.habitacion.id,
      habitacion: o.cama.habitacion.numero,
      desde: deFechaBd(o.fechaInicio),
      hasta: o.fechaFin ? deFechaBd(o.fechaFin) : null,
    })),
  };
}

export type ReservaPresentada = ReturnType<typeof presentarReserva>;

export async function leerReserva(tx: Tx | typeof prisma, id: string): Promise<ReservaBd> {
  const r = await tx.reserva.findUnique({ where: { id }, select: reservaSelect });
  if (!r) throw new AppError(404, 'Reserva no encontrada', 'NOT_FOUND');
  return r;
}
