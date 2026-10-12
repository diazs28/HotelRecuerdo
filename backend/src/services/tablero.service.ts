// Tablero del día: llegadas, salidas, solicitudes pendientes, estado de habitaciones e indicadores.
// Cada indicador declara su periodo y su fórmula para que el personal sepa cómo se calcula.

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { aFechaBd, hoyEnHotel, sumarDias } from '../domain/fechas.js';
import { ESTADOS_CONFIRMADOS, ESTADOS_PROVISIONALES } from '../domain/estadosReserva.js';
import type { PermisosDatos } from '../domain/privacidad.js';
import { estadoCamasEnNoche } from './disponibilidad.service.js';
import { presentarReserva, reservaSelect } from './reservas.presentacion.js';

export const DIAS_PERIODO_INDICADORES = 30;

function porcentaje(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return Math.round((numerador / denominador) * 1000) / 10;
}

// Camas-noche ocupadas por reservas confirmadas/en alojamiento/finalizadas y camas-noche bloqueadas
// en [desde, hasta)
async function camasNoche(desde: string, hasta: string) {
  const filas = await prisma.$queryRaw<
    Array<{ ocupadas: bigint | null; bloqueadas: bigint | null }>
  >(
    Prisma.sql`
      SELECT
        SUM(CASE WHEN o.tipo = 'RESERVA'
              THEN LEAST(o.fecha_fin, ${hasta}::date) - GREATEST(o.fecha_inicio, ${desde}::date) END) AS ocupadas,
        SUM(CASE WHEN o.tipo = 'BLOQUEO'
              THEN LEAST(COALESCE(o.fecha_fin, ${hasta}::date), ${hasta}::date) - GREATEST(o.fecha_inicio, ${desde}::date) END) AS bloqueadas
      FROM ocupaciones_cama o
      JOIN camas c ON c.id = o.cama_id AND c.activa
      LEFT JOIN reservas r ON r.id = o.reserva_id
      WHERE o.activa
        AND o.fecha_inicio < ${hasta}::date
        AND (o.fecha_fin IS NULL OR o.fecha_fin > ${desde}::date)
        AND (o.tipo = 'BLOQUEO' OR r.estado::text IN (${Prisma.join(ESTADOS_CONFIRMADOS)}))`,
  );
  const f = filas[0];
  return { ocupadas: Number(f?.ocupadas ?? 0), bloqueadas: Number(f?.bloqueadas ?? 0) };
}

export async function tablero(permisos: PermisosDatos) {
  const hoy = hoyEnHotel();
  const fechaHoy = aFechaBd(hoy);
  const inicioPeriodo = sumarDias(hoy, -DIAS_PERIODO_INDICADORES);

  const [llegadas, salidas, pendientes, totalPendientes, estadoHoy, periodo, solicitudes] =
    await Promise.all([
      prisma.reserva.findMany({
        where: { fechaEntrada: fechaHoy, estado: { in: ['CONFIRMADA', 'PENDIENTE_CONFIRMACION'] } },
        orderBy: { numero: 'asc' },
        select: reservaSelect,
      }),
      prisma.reserva.findMany({
        where: { fechaSalida: fechaHoy, estado: 'EN_ALOJAMIENTO' },
        orderBy: { numero: 'asc' },
        select: reservaSelect,
      }),
      prisma.reserva.findMany({
        where: { estado: { in: [...ESTADOS_PROVISIONALES] } },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: reservaSelect,
      }),
      prisma.reserva.count({ where: { estado: { in: [...ESTADOS_PROVISIONALES] } } }),
      estadoCamasEnNoche(hoy),
      camasNoche(inicioPeriodo, hoy),
      prisma.reserva.groupBy({
        by: ['estado'],
        where: { createdAt: { gte: aFechaBd(inicioPeriodo), lt: aFechaBd(sumarDias(hoy, 1)) } },
        _count: { _all: true },
      }),
    ]);

  const camasEnServicioHoy =
    estadoHoy.totalCamas - estadoHoy.camas.BLOQUEADA - estadoHoy.camas.MANTENIMIENTO;
  const camasNocheDisponibles =
    estadoHoy.totalCamas * DIAS_PERIODO_INDICADORES - periodo.bloqueadas;
  const recibidas = solicitudes.reduce((s, g) => s + g._count._all, 0);
  const convertidas = solicitudes
    .filter((g) => ESTADOS_CONFIRMADOS.includes(g.estado))
    .reduce((s, g) => s + g._count._all, 0);

  const presentar = (r: Parameters<typeof presentarReserva>[0]) => presentarReserva(r, permisos);

  return {
    hoy,
    llegadas: llegadas.map(presentar),
    salidas: salidas.map(presentar),
    pendientes: { total: totalPendientes, primeras: pendientes.map(presentar) },
    habitaciones: estadoHoy.habitaciones,
    camas: estadoHoy.camas,
    indicadores: [
      {
        clave: 'ocupacion_hoy',
        nombre: 'Ocupación de camas esta noche',
        valor: porcentaje(estadoHoy.camas.OCUPADA, camasEnServicioHoy),
        unidad: '%',
        periodo: `Noche del ${hoy}`,
        formula:
          'Camas ocupadas por reservas confirmadas o en alojamiento ÷ camas en servicio (sin bloqueadas ni en mantenimiento) × 100',
        detalle: { ocupadas: estadoHoy.camas.OCUPADA, enServicio: camasEnServicioHoy },
      },
      {
        clave: 'ocupacion_periodo',
        nombre: `Ocupación de camas, últimos ${DIAS_PERIODO_INDICADORES} días`,
        valor: porcentaje(periodo.ocupadas, camasNocheDisponibles),
        unidad: '%',
        periodo: `Noches del ${inicioPeriodo} al ${sumarDias(hoy, -1)}`,
        formula:
          'Camas-noche ocupadas (reservas confirmadas, en alojamiento o finalizadas) ÷ (camas activas hoy × días − camas-noche bloqueadas) × 100',
        detalle: { camasNocheOcupadas: periodo.ocupadas, camasNocheDisponibles },
      },
      {
        clave: 'conversion',
        nombre: `Conversión de solicitudes, últimos ${DIAS_PERIODO_INDICADORES} días`,
        valor: porcentaje(convertidas, recibidas),
        unidad: '%',
        periodo: `Solicitudes y reservas registradas del ${inicioPeriodo} al ${hoy}`,
        formula:
          'Registradas en el periodo que hoy están confirmadas, en alojamiento o finalizadas ÷ todas las registradas en el periodo × 100',
        detalle: { recibidas, convertidas },
      },
    ],
  };
}
