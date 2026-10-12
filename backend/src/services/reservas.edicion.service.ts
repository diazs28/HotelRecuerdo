// Edición de una reserva existente (fechas, huéspedes, canal, notas, responsable).
// Todo se decide con la reserva leída DESPUÉS de bloquear su fila: un cambio hecho al mismo tiempo
// por otra persona nunca se revierte en silencio.

import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { aFechaBd, deFechaBd, hoyEnHotel, validarRangoEstancia } from '../domain/fechas.js';
import {
  ESTADOS_EDITABLES,
  capacidadSuficiente,
  type EstadoReserva,
} from '../domain/estadosReserva.js';
import type { PermisosDatos } from '../domain/privacidad.js';
import type { ActualizarReservaInput } from '../schemas/reservas.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import {
  bloquearReserva,
  conControlDeCruces,
  moverOcupacionesReserva,
  moverSalidaOcupaciones,
} from './ocupaciones.service.js';
import { validarReferencias } from './reservas.service.js';
import {
  leerReserva,
  ocupacionesVigentes,
  plazasAsignadas,
  presentarReserva,
  type ReservaBd,
  type ReservaPresentada,
} from './reservas.presentacion.js';

type Campo = keyof ActualizarReservaInput;

// Campos que se pueden editar según el estado (docs/adr/0004)
function camposPermitidos(estado: EstadoReserva): ReadonlySet<Campo> {
  if (ESTADOS_EDITABLES.includes(estado)) {
    return new Set<Campo>([
      'fechaEntrada',
      'fechaSalida',
      'cantidadHuespedes',
      'canalId',
      'tipoHabitacionPreferidoId',
      'notasOperativas',
      'responsableId',
    ]);
  }
  if (estado === 'EN_ALOJAMIENTO') {
    return new Set<Campo>(['fechaSalida', 'cantidadHuespedes', 'notasOperativas', 'responsableId']);
  }
  return new Set<Campo>(['notasOperativas']);
}

// Reglas de la edición sobre la reserva vigente. Devuelve las fechas resultantes.
function validarEdicion(r: ReservaBd, datos: ActualizarReservaInput) {
  const noPermitidos = (Object.keys(datos) as Campo[]).filter(
    (k) => !camposPermitidos(r.estado).has(k),
  );
  if (noPermitidos.length > 0) {
    throw new AppError(
      409,
      'Ese dato ya no se puede cambiar en el estado actual de la reserva',
      'CAMPO_NO_EDITABLE',
      noPermitidos.map((k) => ({ path: k, message: 'No editable en este estado' })),
    );
  }

  const entrada = datos.fechaEntrada ?? deFechaBd(r.fechaEntrada);
  const salida = datos.fechaSalida ?? deFechaBd(r.fechaSalida);
  const errorRango = validarRangoEstancia(entrada, salida);
  if (errorRango) {
    throw new AppError(400, 'La fecha de salida debe ser posterior a la de entrada', errorRango, [
      { path: 'fechaSalida', message: 'Revisa las fechas de la estancia' },
    ]);
  }
  // En una estancia en curso, la salida nueva debe dejar al menos esta noche (para irse hoy se
  // registra la salida)
  if (r.estado === 'EN_ALOJAMIENTO' && datos.fechaSalida && datos.fechaSalida <= hoyEnHotel()) {
    throw new AppError(409, 'La nueva salida debe ser posterior a hoy', 'FECHA_INVALIDA', [
      { path: 'fechaSalida', message: 'Para que el huésped salga hoy, registra la salida' },
    ]);
  }

  const cantidad = datos.cantidadHuespedes ?? r.cantidadHuespedes;
  if (
    (r.estado === 'CONFIRMADA' || r.estado === 'EN_ALOJAMIENTO') &&
    !capacidadSuficiente(plazasAsignadas(r), cantidad)
  ) {
    throw new AppError(
      409,
      'Las camas asignadas no alcanzan para esa cantidad de huéspedes; asigna más camas primero',
      'CAPACIDAD_INSUFICIENTE',
    );
  }
  return { entrada, salida };
}

async function aplicarEdicion(
  tx: Tx,
  id: string,
  datos: ActualizarReservaInput,
  usuarioId: string,
) {
  await bloquearReserva(tx, id);
  const r = await leerReserva(tx, id);
  const { entrada, salida } = validarEdicion(r, datos);
  await validarReferencias(tx, datos);

  const entradaAntes = deFechaBd(r.fechaEntrada);
  const salidaAntes = deFechaBd(r.fechaSalida);
  const cambiaFechas = entrada !== entradaAntes || salida !== salidaAntes;

  await tx.reserva.update({
    where: { id },
    data: {
      ...(cambiaFechas ? { fechaEntrada: aFechaBd(entrada), fechaSalida: aFechaBd(salida) } : {}),
      ...(datos.cantidadHuespedes !== undefined
        ? { cantidadHuespedes: datos.cantidadHuespedes }
        : {}),
      ...(datos.canalId !== undefined ? { canalId: datos.canalId } : {}),
      ...(datos.tipoHabitacionPreferidoId !== undefined
        ? { tipoHabitacionPreferidoId: datos.tipoHabitacionPreferidoId }
        : {}),
      ...(datos.notasOperativas !== undefined ? { notasOperativas: datos.notasOperativas } : {}),
      ...(datos.responsableId !== undefined ? { responsableId: datos.responsableId } : {}),
    },
  });
  if (cambiaFechas) {
    if (r.estado === 'EN_ALOJAMIENTO') await moverSalidaOcupaciones(tx, id, salidaAntes, salida);
    else await moverOcupacionesReserva(tx, id, entrada, salida);
  }

  await registrarAuditoria(tx, {
    usuarioId,
    accion: 'reserva.actualizada',
    entidad: 'reserva',
    entidadId: id,
    datos: {
      campos: Object.keys(datos),
      ...(cambiaFechas
        ? { fechasAntes: [entradaAntes, salidaAntes], fechasDespues: [entrada, salida] }
        : {}),
      ...(datos.cantidadHuespedes !== undefined
        ? { cantidadAntes: r.cantidadHuespedes, cantidadDespues: datos.cantidadHuespedes }
        : {}),
    },
  });
}

export async function actualizarReserva(
  id: string,
  datos: ActualizarReservaInput,
  usuarioId: string,
  permisos: PermisosDatos,
): Promise<ReservaPresentada> {
  // Solo para describir un posible conflicto de camas (la decisión se toma dentro de la transacción)
  const contexto = await leerReserva(prisma, id);
  await conControlDeCruces(
    () => prisma.$transaction((tx) => aplicarEdicion(tx, id, datos, usuarioId)),
    {
      camaIds: () => ocupacionesVigentes(contexto).map((o) => o.cama.id),
      inicio: datos.fechaEntrada ?? deFechaBd(contexto.fechaEntrada),
      fin: datos.fechaSalida ?? deFechaBd(contexto.fechaSalida),
      excluir: { reservaId: id },
    },
  );
  return presentarReserva(await leerReserva(prisma, id), permisos);
}
