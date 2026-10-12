// Disponibilidad calculada SIEMPRE en el servidor a partir de las ocupaciones activas.

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { aFechaBd, deFechaBd, noches, sumarDias } from '../domain/fechas.js';
import { codigoReserva, type EstadoReserva } from '../domain/estadosReserva.js';
import {
  estadoCamaEnNoche,
  estadoHabitacion,
  type EstadoCama,
  type OcupacionResumen,
} from '../domain/ocupacion.js';

export const MAX_DIAS_MAPA = 62;

interface OpcionesMapa {
  // Sin permiso para ver datos de huéspedes, el mapa muestra solo el código de la reserva
  verNombres: boolean;
}

// Mapa de ocupación: habitaciones -> camas -> ocupaciones en [desde, hasta). Base del calendario.
export async function mapaOcupacion(desde: string, hasta: string, opciones: OpcionesMapa) {
  if (noches(desde, hasta) > MAX_DIAS_MAPA) {
    throw new AppError(
      400,
      `El rango máximo es de ${MAX_DIAS_MAPA} días`,
      'RANGO_DEMASIADO_LARGO',
      [{ path: 'hasta', message: `Máximo ${MAX_DIAS_MAPA} días` }],
    );
  }
  const habitaciones = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
    select: {
      id: true,
      numero: true,
      capacidad: true,
      tipoHabitacion: { select: { id: true, nombre: true } },
      camas: {
        where: { activa: true },
        orderBy: { identificador: 'asc' },
        select: {
          id: true,
          identificador: true,
          tipo: true,
          plazas: true,
          ocupaciones: {
            where: {
              activa: true,
              fechaInicio: { lt: aFechaBd(hasta) },
              OR: [{ fechaFin: null }, { fechaFin: { gt: aFechaBd(desde) } }],
            },
            orderBy: { fechaInicio: 'asc' },
            select: {
              id: true,
              tipo: true,
              fechaInicio: true,
              fechaFin: true,
              reserva: {
                select: {
                  id: true,
                  numero: true,
                  estado: true,
                  cantidadHuespedes: true,
                  huesped: { select: { nombres: true, apellidos: true } },
                },
              },
              bloqueo: { select: { id: true, tipo: true, motivo: true } },
            },
          },
        },
      },
    },
  });

  return {
    desde,
    hasta,
    habitaciones: habitaciones.map((h) => {
      const camas = h.camas.map((c) => {
        const ocupaciones = c.ocupaciones.map((o) => ({
          id: o.id,
          tipo: o.tipo,
          desde: deFechaBd(o.fechaInicio),
          hasta: o.fechaFin ? deFechaBd(o.fechaFin) : null,
          reserva: o.reserva
            ? {
                id: o.reserva.id,
                codigo: codigoReserva(o.reserva.numero),
                estado: o.reserva.estado,
                cantidadHuespedes: o.reserva.cantidadHuespedes,
                titular: opciones.verNombres
                  ? `${o.reserva.huesped.nombres} ${o.reserva.huesped.apellidos}`
                  : null,
              }
            : null,
          bloqueo: o.bloqueo,
        }));
        const resumen: OcupacionResumen[] = ocupaciones.map((o) => ({
          tipo: o.tipo,
          fechaInicio: o.desde,
          fechaFin: o.hasta,
          estadoReserva: o.reserva?.estado ?? null,
          tipoBloqueo: o.bloqueo?.tipo ?? null,
        }));
        return {
          id: c.id,
          identificador: c.identificador,
          tipo: c.tipo,
          plazas: c.plazas,
          // Estado en la primera noche del rango (normalmente hoy)
          estado: estadoCamaEnNoche(resumen, desde),
          ocupaciones,
        };
      });
      return {
        id: h.id,
        numero: h.numero,
        capacidad: h.capacidad,
        tipoHabitacion: h.tipoHabitacion,
        estado: estadoHabitacion(camas.map((c) => c.estado)),
        camas,
      };
    }),
  };
}

interface FilaCamaLibre {
  cama_id: string;
  identificador: string;
  tipo_cama: string;
  plazas: number;
  habitacion_id: string;
  numero: string;
  capacidad: number;
  tipo_habitacion_id: string;
  tipo_habitacion: string;
}

// Camas activas sin ninguna ocupación activa que se cruce con [entrada, salida)
export async function camasLibres(entrada: string, salida: string, excluirReservaId?: string) {
  const excluir = excluirReservaId
    ? Prisma.sql`AND (o.reserva_id IS NULL OR o.reserva_id <> ${excluirReservaId}::uuid)`
    : Prisma.empty;
  const filas = await prisma.$queryRaw<FilaCamaLibre[]>(Prisma.sql`
    SELECT c.id AS cama_id, c.identificador, c.tipo::text AS tipo_cama, c.plazas,
           h.id AS habitacion_id, h.numero, h.capacidad,
           t.id AS tipo_habitacion_id, t.nombre AS tipo_habitacion
    FROM camas c
    JOIN habitaciones h ON h.id = c.habitacion_id
    JOIN tipos_habitacion t ON t.id = h.tipo_habitacion_id
    WHERE c.activa AND h.activa
      AND NOT EXISTS (
        SELECT 1 FROM ocupaciones_cama o
        WHERE o.cama_id = c.id AND o.activa ${excluir}
          AND daterange(o.fecha_inicio, o.fecha_fin, '[)') && daterange(${entrada}::date, ${salida}::date, '[)')
      )
    ORDER BY h.orden, h.numero, c.identificador`);

  // Agrupadas por habitación, indicando si la habitación queda libre completa
  const totalPorHabitacion = await prisma.cama.groupBy({
    by: ['habitacionId'],
    where: { activa: true, habitacion: { activa: true } },
    _count: { _all: true },
  });
  const totales = new Map(totalPorHabitacion.map((t) => [t.habitacionId, t._count._all]));

  const porHabitacion = new Map<
    string,
    {
      habitacionId: string;
      numero: string;
      capacidad: number;
      tipoHabitacion: { id: string; nombre: string };
      completa: boolean;
      camas: Array<{ id: string; identificador: string; tipo: string; plazas: number }>;
    }
  >();
  for (const f of filas) {
    let h = porHabitacion.get(f.habitacion_id);
    if (!h) {
      h = {
        habitacionId: f.habitacion_id,
        numero: f.numero,
        capacidad: f.capacidad,
        tipoHabitacion: { id: f.tipo_habitacion_id, nombre: f.tipo_habitacion },
        completa: false,
        camas: [],
      };
      porHabitacion.set(f.habitacion_id, h);
    }
    h.camas.push({
      id: f.cama_id,
      identificador: f.identificador,
      tipo: f.tipo_cama,
      plazas: f.plazas,
    });
  }
  for (const h of porHabitacion.values()) {
    h.completa = h.camas.length === (totales.get(h.habitacionId) ?? -1);
  }

  const habitaciones = [...porHabitacion.values()];
  return {
    fechaEntrada: entrada,
    fechaSalida: salida,
    camasLibres: filas.length,
    plazasLibres: filas.reduce((s, f) => s + f.plazas, 0),
    habitaciones,
  };
}

// Consulta pública: solo dice si parece haber cupo (sin revelar ocupación detallada).
// Cuenta habitaciones COMPLETAMENTE libres en todo el rango.
export async function disponibilidadPublica(entrada: string, salida: string, huespedes: number) {
  const libres = await camasLibres(entrada, salida);
  const completas = libres.habitaciones.filter((h) => h.completa);
  const tipos = await prisma.tipoHabitacion.findMany({
    where: { activo: true, publicado: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true },
  });
  const capacidadLibre = completas.reduce((s, h) => s + h.capacidad, 0);
  return {
    fechaEntrada: entrada,
    fechaSalida: salida,
    noches: noches(entrada, salida),
    hayDisponibilidad: capacidadLibre >= huespedes,
    porTipo: tipos.map((t) => ({
      tipoHabitacionId: t.id,
      nombre: t.nombre,
      disponible: completas.some((h) => h.tipoHabitacion.id === t.id),
    })),
    aviso:
      'Resultado orientativo. La disponibilidad se confirma cuando el personal del hotel revisa tu solicitud.',
  };
}

// Conteo de camas por estado en una noche (para el tablero)
export async function estadoCamasEnNoche(noche: string) {
  const mapa = await mapaOcupacion(noche, sumarDias(noche, 1), { verNombres: false });
  const camas: Record<EstadoCama, number> = {
    DISPONIBLE: 0,
    RETENIDA: 0,
    OCUPADA: 0,
    BLOQUEADA: 0,
    MANTENIMIENTO: 0,
  };
  const habitaciones = { DISPONIBLE: 0, PARCIAL: 0, OCUPADA: 0, FUERA_DE_SERVICIO: 0 };
  for (const h of mapa.habitaciones) {
    habitaciones[h.estado] += 1;
    for (const c of h.camas) camas[c.estado] += 1;
  }
  return {
    camas,
    habitaciones,
    totalCamas: mapa.habitaciones.reduce((s, h) => s + h.camas.length, 0),
  };
}

export type { EstadoReserva };
