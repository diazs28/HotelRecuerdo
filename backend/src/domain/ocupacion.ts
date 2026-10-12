// Estado de camas y habitaciones en una noche, a partir de sus ocupaciones. Funciones puras.

import { incluyeNoche } from './fechas.js';
import type { EstadoReserva } from './estadosReserva.js';

export type EstadoCama = 'DISPONIBLE' | 'RETENIDA' | 'OCUPADA' | 'BLOQUEADA' | 'MANTENIMIENTO';

export type EstadoHabitacion = 'DISPONIBLE' | 'PARCIAL' | 'OCUPADA' | 'FUERA_DE_SERVICIO';

export interface OcupacionResumen {
  tipo: 'RESERVA' | 'BLOQUEO';
  fechaInicio: string;
  fechaFin: string | null;
  estadoReserva?: EstadoReserva | null;
  tipoBloqueo?: 'BLOQUEO' | 'MANTENIMIENTO' | null;
}

export const ETIQUETAS_ESTADO_CAMA: Record<EstadoCama, string> = {
  DISPONIBLE: 'Disponible',
  RETENIDA: 'Retenida (solicitud sin confirmar)',
  OCUPADA: 'Ocupada',
  BLOQUEADA: 'Bloqueada',
  MANTENIMIENTO: 'En mantenimiento',
};

function estadoDeOcupacion(o: OcupacionResumen): EstadoCama {
  if (o.tipo === 'BLOQUEO')
    return o.tipoBloqueo === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'BLOQUEADA';
  return o.estadoReserva === 'SOLICITUD' || o.estadoReserva === 'PENDIENTE_CONFIRMACION'
    ? 'RETENIDA'
    : 'OCUPADA';
}

// Solo puede haber una ocupación activa por cama y noche (lo garantiza la base de datos)
export function estadoCamaEnNoche(
  ocupaciones: readonly OcupacionResumen[],
  noche: string,
): EstadoCama {
  const o = ocupaciones.find((x) => incluyeNoche(x.fechaInicio, x.fechaFin, noche));
  return o ? estadoDeOcupacion(o) : 'DISPONIBLE';
}

// Habitación: fuera de servicio si todas sus camas están bloqueadas o en mantenimiento (o no tiene
// camas); ocupada si todas las camas en servicio están tomadas; parcial si hay tomadas y libres.
export function estadoHabitacion(estadosCamas: readonly EstadoCama[]): EstadoHabitacion {
  const enServicio = estadosCamas.filter((e) => e !== 'BLOQUEADA' && e !== 'MANTENIMIENTO');
  if (enServicio.length === 0) return 'FUERA_DE_SERVICIO';
  const tomadas = enServicio.filter((e) => e === 'OCUPADA' || e === 'RETENIDA').length;
  if (tomadas === 0) return 'DISPONIBLE';
  return tomadas === enServicio.length ? 'OCUPADA' : 'PARCIAL';
}
