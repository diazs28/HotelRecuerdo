// Bloqueos y mantenimiento de habitaciones completas o de camas, con motivo y periodo.
// Un bloqueo crea ocupaciones en cada cama afectada: la misma restricción de la base de datos que
// impide la sobreventa impide asignar una cama bloqueada (y bloquear una cama ya reservada).

import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { aFechaBd, deFechaBd, hoyEnHotel } from '../domain/fechas.js';
import type { CrearBloqueoInput } from '../schemas/habitaciones.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import { conControlDeCruces, crearOcupacionesBloqueo } from './ocupaciones.service.js';

const bloqueoSelect = {
  id: true,
  tipo: true,
  fechaInicio: true,
  fechaFin: true,
  motivo: true,
  liberadoEn: true,
  createdAt: true,
  habitacion: { select: { id: true, numero: true } },
  cama: { select: { id: true, identificador: true } },
  creadoPor: { select: { id: true, nombre: true } },
  liberadoPor: { select: { id: true, nombre: true } },
} as const satisfies Prisma.BloqueoSelect;

type BloqueoBd = Prisma.BloqueoGetPayload<{ select: typeof bloqueoSelect }>;

function presentar(b: BloqueoBd) {
  return {
    ...b,
    fechaInicio: deFechaBd(b.fechaInicio),
    fechaFin: b.fechaFin ? deFechaBd(b.fechaFin) : null,
    alcance: b.cama ? ('CAMA' as const) : ('HABITACION' as const),
  };
}

export async function listarBloqueos(filtros: { habitacionId?: string; vigentes: boolean }) {
  const hoy = aFechaBd(hoyEnHotel());
  const bloqueos = await prisma.bloqueo.findMany({
    where: {
      ...(filtros.habitacionId ? { habitacionId: filtros.habitacionId } : {}),
      ...(filtros.vigentes
        ? { liberadoEn: null, OR: [{ fechaFin: null }, { fechaFin: { gt: hoy } }] }
        : {}),
    },
    orderBy: [{ fechaInicio: 'desc' }],
    take: 200,
    select: bloqueoSelect,
  });
  return bloqueos.map(presentar);
}

export async function crearBloqueo(datos: CrearBloqueoInput, usuarioId: string) {
  const habitacion = await prisma.habitacion.findUnique({
    where: { id: datos.habitacionId },
    select: {
      activa: true,
      camas: { where: { activa: true }, select: { id: true } },
    },
  });
  if (!habitacion) throw new AppError(404, 'Habitación no encontrada', 'NOT_FOUND');
  if (!habitacion.activa) {
    throw new AppError(409, 'La habitación está retirada', 'HABITACION_RETIRADA');
  }

  let camaIds = habitacion.camas.map((c) => c.id);
  if (datos.camaId) {
    if (!camaIds.includes(datos.camaId)) {
      throw new AppError(
        422,
        'La cama no pertenece a la habitación o está retirada',
        'CAMA_INVALIDA',
        [{ path: 'camaId', message: 'Selecciona una cama activa de la habitación' }],
      );
    }
    camaIds = [datos.camaId];
  }
  const fin = datos.fechaFin ?? null;

  const id = await conControlDeCruces(
    () =>
      prisma.$transaction(async (tx) => {
        const b = await tx.bloqueo.create({
          data: {
            tipo: datos.tipo,
            habitacionId: datos.habitacionId,
            camaId: datos.camaId ?? null,
            fechaInicio: aFechaBd(datos.fechaInicio),
            fechaFin: fin === null ? null : aFechaBd(fin),
            motivo: datos.motivo,
            creadoPorId: usuarioId,
          },
          select: { id: true },
        });
        await crearOcupacionesBloqueo(tx, b.id, camaIds, datos.fechaInicio, fin);
        await registrarAuditoria(tx, {
          usuarioId,
          accion: 'bloqueo.creado',
          entidad: 'bloqueo',
          entidadId: b.id,
          datos: {
            tipo: datos.tipo,
            habitacionId: datos.habitacionId,
            camaId: datos.camaId ?? null,
            fechaInicio: datos.fechaInicio,
            fechaFin: fin,
            motivo: datos.motivo,
          },
        });
        return b.id;
      }),
    { camaIds: () => camaIds, inicio: datos.fechaInicio, fin },
  );

  const creado = await prisma.bloqueo.findUniqueOrThrow({ where: { id }, select: bloqueoSelect });
  return presentar(creado);
}

// Libera un bloqueo desde hoy: si ya empezó, las noches pasadas quedan en el historial y termina hoy;
// si aún no empezaba, se anula completo.
export async function liberarBloqueo(id: string, usuarioId: string) {
  const hoy = hoyEnHotel();
  await prisma.$transaction(async (tx) => {
    const b = await tx.bloqueo.findUnique({
      where: { id },
      select: { liberadoEn: true, fechaInicio: true, fechaFin: true },
    });
    if (!b) throw new AppError(404, 'Bloqueo no encontrado', 'NOT_FOUND');
    if (b.liberadoEn) throw new AppError(409, 'El bloqueo ya fue liberado', 'YA_LIBERADO');
    if (b.fechaFin && deFechaBd(b.fechaFin) <= hoy) {
      throw new AppError(409, 'El bloqueo ya terminó', 'YA_TERMINADO');
    }

    const ahora = new Date();
    const yaEmpezo = deFechaBd(b.fechaInicio) < hoy;
    // Liberación condicional: si otra persona lo liberó al mismo tiempo, no se repite
    const r = await tx.bloqueo.updateMany({
      where: { id, liberadoEn: null },
      data: {
        liberadoEn: ahora,
        liberadoPorId: usuarioId,
        ...(yaEmpezo ? { fechaFin: aFechaBd(hoy) } : {}),
      },
    });
    if (r.count !== 1) throw new AppError(409, 'El bloqueo ya fue liberado', 'YA_LIBERADO');

    if (yaEmpezo) {
      // Recortar fecha_fin nunca crea cruces: solo libera noches
      await tx.ocupacion.updateMany({
        where: { bloqueoId: id, activa: true },
        data: { fechaFin: aFechaBd(hoy) },
      });
    } else {
      await tx.ocupacion.updateMany({
        where: { bloqueoId: id, activa: true },
        data: { activa: false, liberadaEn: ahora },
      });
    }
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'bloqueo.liberado',
      entidad: 'bloqueo',
      entidadId: id,
      datos: { desde: hoy, yaHabiaEmpezado: yaEmpezo },
    });
  });
  const b = await prisma.bloqueo.findUniqueOrThrow({ where: { id }, select: bloqueoSelect });
  return presentar(b);
}
