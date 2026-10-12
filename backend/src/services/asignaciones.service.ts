// Asignación de camas a una reserva (una o varias camas, o habitaciones completas).

import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { deFechaBd, hoyEnHotel } from '../domain/fechas.js';
import { ESTADOS_ASIGNABLES, capacidadSuficiente } from '../domain/estadosReserva.js';
import type { PermisosDatos } from '../domain/privacidad.js';
import type { AsignarCamasInput } from '../schemas/reservas.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import {
  bloquearCamas,
  bloquearReserva,
  conControlDeCruces,
  cortarOcupacionesDesde,
  crearOcupacionesReserva,
  liberarOcupacionesReserva,
} from './ocupaciones.service.js';
import {
  leerReserva,
  ocupacionesVigentes,
  plazasAsignadas,
  presentarReserva,
} from './reservas.presentacion.js';

// Camas activas de habitaciones activas: las indicadas y todas las de las habitaciones indicadas
export async function resolverCamasAsignables(
  camaIds: readonly string[],
  habitacionIds: readonly string[],
) {
  const camas = await prisma.cama.findMany({
    where: {
      activa: true,
      habitacion: { activa: true },
      OR: [{ id: { in: [...camaIds] } }, { habitacionId: { in: [...habitacionIds] } }],
    },
    select: { id: true, habitacionId: true, plazas: true },
  });
  const encontradas = new Set(camas.map((c) => c.id));
  const faltantes = camaIds.filter((id) => !encontradas.has(id));
  if (faltantes.length > 0) {
    throw new AppError(422, 'Alguna cama no existe o está retirada', 'CAMA_INVALIDA', [
      { path: 'camaIds', message: 'Selecciona camas activas' },
    ]);
  }
  const habitacionesConCamas = new Set(camas.map((c) => c.habitacionId));
  if (habitacionIds.some((id) => !habitacionesConCamas.has(id))) {
    throw new AppError(
      422,
      'Alguna habitación no existe, está retirada o no tiene camas',
      'HABITACION_INVALIDA',
      [{ path: 'habitacionIds', message: 'Selecciona habitaciones activas con camas' }],
    );
  }
  return camas;
}

const estadoNoAsignable = () =>
  new AppError(
    409,
    'No se pueden cambiar las camas de una reserva finalizada o cancelada',
    'ESTADO_NO_PERMITE_ASIGNAR',
  );

export async function asignarCamas(
  reservaId: string,
  datos: AsignarCamasInput,
  usuarioId: string,
  permisos: PermisosDatos,
) {
  const actual = await leerReserva(prisma, reservaId);
  const camas = await resolverCamasAsignables(datos.camaIds, datos.habitacionIds);
  const yaAsignadas = new Set(ocupacionesVigentes(actual).map((o) => o.cama.id));
  const nuevas = camas.map((c) => c.id).filter((id) => !yaAsignadas.has(id));
  const entrada = deFechaBd(actual.fechaEntrada);
  const salida = deFechaBd(actual.fechaSalida);

  await conControlDeCruces(
    () =>
      prisma.$transaction(async (tx) => {
        await bloquearReserva(tx, reservaId);
        const r = await leerReserva(tx, reservaId);
        if (!ESTADOS_ASIGNABLES.includes(r.estado)) throw estadoNoAsignable();
        // Las fechas pudieron cambiar entre la lectura y el bloqueo: se usan las vigentes
        const asignadas = new Set(ocupacionesVigentes(r).map((o) => o.cama.id));
        const porCrear = nuevas.filter((id) => !asignadas.has(id));
        if (porCrear.length === 0) return;

        // La cama no puede retirarse mientras se asigna (bloqueo compartido de sus filas)
        const activas = await bloquearCamas(tx, porCrear, 'compartido');
        if (porCrear.some((id) => !activas.has(id))) {
          throw new AppError(409, 'Alguna cama fue retirada mientras se asignaba', 'CAMA_INVALIDA');
        }

        // En una estancia en curso, la cama nueva se ocupa desde hoy (las noches pasadas no cambian)
        const entradaReal = deFechaBd(r.fechaEntrada);
        const hoy = hoyEnHotel();
        const desde = r.estado === 'EN_ALOJAMIENTO' && hoy > entradaReal ? hoy : entradaReal;
        await crearOcupacionesReserva(tx, reservaId, porCrear, desde, deFechaBd(r.fechaSalida));
        await registrarAuditoria(tx, {
          usuarioId,
          accion: 'reserva.camas_asignadas',
          entidad: 'reserva',
          entidadId: reservaId,
          datos: {
            camaIds: porCrear,
            desde,
            fechaSalida: deFechaBd(r.fechaSalida),
          },
        });
      }),
    { camaIds: () => nuevas, inicio: entrada, fin: salida, excluir: { reservaId } },
  );

  return presentarReserva(await leerReserva(prisma, reservaId), permisos);
}

export async function quitarCama(
  reservaId: string,
  camaId: string,
  usuarioId: string,
  permisos: PermisosDatos,
) {
  await prisma.$transaction(async (tx) => {
    await bloquearReserva(tx, reservaId);
    const r = await leerReserva(tx, reservaId);
    if (!ESTADOS_ASIGNABLES.includes(r.estado)) throw estadoNoAsignable();

    const ocupacion = ocupacionesVigentes(r).find((o) => o.cama.id === camaId);
    if (!ocupacion) throw new AppError(404, 'La cama no está asignada a esta reserva', 'NOT_FOUND');

    // Una reserva confirmada o en alojamiento debe conservar camas suficientes
    const restantes = plazasAsignadas(r) - ocupacion.cama.plazas;
    if (
      (r.estado === 'CONFIRMADA' || r.estado === 'EN_ALOJAMIENTO') &&
      !capacidadSuficiente(restantes, r.cantidadHuespedes)
    ) {
      throw new AppError(
        409,
        'Sin esta cama no alcanzan las plazas para los huéspedes; asigna otra cama antes de quitarla',
        'CAPACIDAD_INSUFICIENTE',
      );
    }

    // En una estancia en curso las noches ya usadas quedan en el historial; si no, se libera todo
    if (r.estado === 'EN_ALOJAMIENTO') {
      await cortarOcupacionesDesde(tx, { id: ocupacion.id }, hoyEnHotel());
    } else {
      await liberarOcupacionesReserva(tx, reservaId, [camaId]);
    }
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'reserva.cama_liberada',
      entidad: 'reserva',
      entidadId: reservaId,
      datos: { camaId },
    });
  });
  return presentarReserva(await leerReserva(prisma, reservaId), permisos);
}
