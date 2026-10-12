// Habitaciones y camas. La distribución real (cuántas camas por habitación, de qué tipo) la configura
// el personal; el sistema no asume que "20 habitaciones y 37 camas" defina cómo se reparten.

import type { Prisma } from '../generated/prisma/client.js';
import { esUnicoRepetido } from '../utils/erroresBd.js';
import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { aFechaBd, deFechaBd, hoyEnHotel } from '../domain/fechas.js';
import type {
  ActualizarCamaInput,
  ActualizarHabitacionInput,
  CrearCamaInput,
  CrearHabitacionInput,
} from '../schemas/habitaciones.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import { bloquearCamas, crearOcupacionesBloqueo } from './ocupaciones.service.js';

const habitacionSelect = {
  id: true,
  numero: true,
  capacidad: true,
  piso: true,
  descripcion: true,
  activa: true,
  orden: true,
  tipoHabitacion: { select: { id: true, nombre: true } },
  camas: {
    orderBy: [{ activa: 'desc' }, { identificador: 'asc' }],
    select: { id: true, identificador: true, tipo: true, plazas: true, activa: true },
  },
} as const satisfies Prisma.HabitacionSelect;

const numeroRepetido = () =>
  new AppError(409, 'Ya existe una habitación activa con ese número o nombre', 'NUMERO_REPETIDO', [
    { path: 'numero', message: 'Usa otro número o nombre' },
  ]);

const identificadorRepetido = () =>
  new AppError(409, 'Ya hay una cama con ese identificador en la habitación', 'CAMA_REPETIDA', [
    { path: 'identificador', message: 'Usa otro identificador' },
  ]);

async function validarTipo(tx: Tx, tipoHabitacionId: string): Promise<void> {
  const tipo = await tx.tipoHabitacion.findUnique({
    where: { id: tipoHabitacionId },
    select: { activo: true },
  });
  if (!tipo?.activo) {
    throw new AppError(422, 'El tipo de habitación no existe o está inactivo', 'TIPO_INVALIDO', [
      { path: 'tipoHabitacionId', message: 'Selecciona un tipo activo' },
    ]);
  }
}

// ---------- Habitaciones ----------

export function listarHabitaciones(incluirInactivas: boolean) {
  return prisma.habitacion.findMany({
    where: incluirInactivas ? {} : { activa: true },
    orderBy: [{ activa: 'desc' }, { orden: 'asc' }, { numero: 'asc' }],
    select: habitacionSelect,
  });
}

export async function obtenerHabitacion(id: string) {
  const h = await prisma.habitacion.findUnique({ where: { id }, select: habitacionSelect });
  if (!h) throw new AppError(404, 'Habitación no encontrada', 'NOT_FOUND');
  return h;
}

export async function crearHabitacion(datos: CrearHabitacionInput, usuarioId: string) {
  const identificadores = datos.camas.map((c) => c.identificador.toLowerCase());
  if (new Set(identificadores).size !== identificadores.length) throw identificadorRepetido();
  try {
    const id = await prisma.$transaction(async (tx) => {
      await validarTipo(tx, datos.tipoHabitacionId);
      const { camas, ...campos } = datos;
      const h = await tx.habitacion.create({
        data: { ...campos, camas: { create: camas } },
        select: { id: true },
      });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'habitacion.creada',
        entidad: 'habitacion',
        entidadId: h.id,
        datos: { numero: datos.numero, camas: camas.length },
      });
      return h.id;
    });
    return obtenerHabitacion(id);
  } catch (err) {
    if (esUnicoRepetido(err, 'numero')) throw numeroRepetido();
    if (esUnicoRepetido(err, 'identificador')) throw identificadorRepetido();
    throw err;
  }
}

// ¿Hay reservas activas con noches desde hoy en estas camas? (impide retirar)
async function reservasFuturas(tx: Tx, camaIds: readonly string[]): Promise<number> {
  if (camaIds.length === 0) return 0;
  return tx.ocupacion.count({
    where: {
      camaId: { in: [...camaIds] },
      activa: true,
      tipo: 'RESERVA',
      fechaFin: { gt: aFechaBd(hoyEnHotel()) },
      reserva: { estado: { notIn: ['CANCELADA', 'FINALIZADA'] } },
    },
  });
}

const tieneReservas = (que: string) =>
  new AppError(
    409,
    `No se puede retirar ${que}: tiene reservas vigentes o futuras. Reasígnalas primero.`,
    'TIENE_RESERVAS',
  );

export async function actualizarHabitacion(
  id: string,
  datos: ActualizarHabitacionInput,
  usuarioId: string,
) {
  try {
    await prisma.$transaction(async (tx) => {
      const actual = await tx.habitacion.findUnique({
        where: { id },
        select: { activa: true, camas: { where: { activa: true }, select: { id: true } } },
      });
      if (!actual) throw new AppError(404, 'Habitación no encontrada', 'NOT_FOUND');
      if (datos.tipoHabitacionId) await validarTipo(tx, datos.tipoHabitacionId);

      const retirar = datos.activa === false && actual.activa;
      if (retirar) {
        const camaIds = actual.camas.map((c) => c.id);
        // Bloqueo exclusivo: nadie puede asignar estas camas mientras se comprueba y se retiran
        await bloquearCamas(tx, camaIds, 'exclusivo');
        if ((await reservasFuturas(tx, camaIds)) > 0) throw tieneReservas('la habitación');
        await tx.cama.updateMany({ where: { habitacionId: id }, data: { activa: false } });
      }
      await tx.habitacion.update({ where: { id }, data: datos });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: retirar ? 'habitacion.retirada' : 'habitacion.actualizada',
        entidad: 'habitacion',
        entidadId: id,
        datos: { campos: Object.keys(datos) },
      });
    });
  } catch (err) {
    if (esUnicoRepetido(err, 'numero')) throw numeroRepetido();
    throw err;
  }
  return obtenerHabitacion(id);
}

// ---------- Camas ----------

export async function crearCama(habitacionId: string, datos: CrearCamaInput, usuarioId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const h = await tx.habitacion.findUnique({
        where: { id: habitacionId },
        select: { activa: true },
      });
      if (!h) throw new AppError(404, 'Habitación no encontrada', 'NOT_FOUND');
      if (!h.activa) {
        throw new AppError(409, 'La habitación está retirada', 'HABITACION_RETIRADA');
      }
      const cama = await tx.cama.create({ data: { ...datos, habitacionId }, select: { id: true } });

      // Los bloqueos vigentes de la habitación completa también aplican a la cama nueva
      const hoy = aFechaBd(hoyEnHotel());
      const bloqueos = await tx.bloqueo.findMany({
        where: {
          habitacionId,
          camaId: null,
          liberadoEn: null,
          OR: [{ fechaFin: null }, { fechaFin: { gt: hoy } }],
        },
        select: { id: true, fechaInicio: true, fechaFin: true },
      });
      for (const b of bloqueos) {
        const inicio = b.fechaInicio > hoy ? b.fechaInicio : hoy;
        await crearOcupacionesBloqueo(
          tx,
          b.id,
          [cama.id],
          deFechaBd(inicio),
          b.fechaFin ? deFechaBd(b.fechaFin) : null,
        );
      }

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'cama.creada',
        entidad: 'cama',
        entidadId: cama.id,
        datos: { habitacionId, identificador: datos.identificador, plazas: datos.plazas },
      });
    });
  } catch (err) {
    if (esUnicoRepetido(err, 'identificador')) throw identificadorRepetido();
    throw err;
  }
  return obtenerHabitacion(habitacionId);
}

export async function actualizarCama(
  habitacionId: string,
  camaId: string,
  datos: ActualizarCamaInput,
  usuarioId: string,
) {
  try {
    await prisma.$transaction(async (tx) => {
      const cama = await tx.cama.findFirst({
        where: { id: camaId, habitacionId },
        select: { activa: true, plazas: true },
      });
      if (!cama) throw new AppError(404, 'Cama no encontrada', 'NOT_FOUND');
      if (datos.activa === false || datos.plazas !== undefined) {
        await bloquearCamas(tx, [camaId], 'exclusivo');
      }
      if (datos.activa === false && cama.activa && (await reservasFuturas(tx, [camaId])) > 0) {
        throw tieneReservas('la cama');
      }
      // Reducir plazas podría dejar sin capacidad a reservas confirmadas: se exige reasignar antes
      if (datos.plazas !== undefined && datos.plazas < cama.plazas) {
        if ((await reservasFuturas(tx, [camaId])) > 0) {
          throw new AppError(
            409,
            'La cama tiene reservas vigentes o futuras; no se pueden reducir sus plazas',
            'TIENE_RESERVAS',
          );
        }
      }
      await tx.cama.update({ where: { id: camaId }, data: datos });
      await registrarAuditoria(tx, {
        usuarioId,
        accion: datos.activa === false ? 'cama.retirada' : 'cama.actualizada',
        entidad: 'cama',
        entidadId: camaId,
        datos: { campos: Object.keys(datos) },
      });
    });
  } catch (err) {
    if (esUnicoRepetido(err, 'identificador')) throw identificadorRepetido();
    throw err;
  }
  return obtenerHabitacion(habitacionId);
}

// Resumen del inventario configurado (para validar contra lo que reporta el hotel)
export async function resumenInventario() {
  const [habitaciones, camas, plazas] = await prisma.$transaction([
    prisma.habitacion.count({ where: { activa: true } }),
    prisma.cama.count({ where: { activa: true, habitacion: { activa: true } } }),
    prisma.cama.aggregate({
      where: { activa: true, habitacion: { activa: true } },
      _sum: { plazas: true },
    }),
  ]);
  return { habitaciones, camas, plazas: plazas._sum.plazas ?? 0 };
}
