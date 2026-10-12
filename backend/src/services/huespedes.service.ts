// Huéspedes: datos mínimos, exposición según permisos y derechos del titular (Ley 1581 de 2012:
// conocer y suprimir). No se afirma cumplimiento legal certificado: ver docs/PRIVACIDAD.md.

import { Prisma } from '../generated/prisma/client.js';
import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { deFechaBd } from '../domain/fechas.js';
import { codigoReserva } from '../domain/estadosReserva.js';
import { presentarHuesped, type PermisosDatos } from '../domain/privacidad.js';
import type { ActualizarHuespedInput, ListarHuespedesQuery } from '../schemas/huespedes.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import { huespedSelect } from './reservas.presentacion.js';

const noEncontrado = () => new AppError(404, 'Huésped no encontrado', 'NOT_FOUND');

// Serializa editar, anonimizar y crear reservas del mismo huésped
async function bloquearHuesped(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM huespedes WHERE id = ${id}::uuid FOR UPDATE`);
}

export async function listarHuespedes(filtros: ListarHuespedesQuery, permisos: PermisosDatos) {
  const q = filtros.q;
  const digitos = q?.replace(/\D/g, '') ?? '';
  const where: Prisma.HuespedWhereInput = {
    anonimizadoEn: null,
    ...(q
      ? {
          OR: [
            { nombres: { contains: q, mode: 'insensitive' } },
            { apellidos: { contains: q, mode: 'insensitive' } },
            { email: { contains: q.toLowerCase() } },
            ...(digitos.length >= 4 ? [{ telefono: { contains: digitos } }] : []),
            ...(permisos.verDocumento && digitos.length >= 4
              ? [{ numeroDocumento: { contains: digitos } }]
              : []),
          ],
        }
      : {}),
  };
  const [total, huespedes] = await prisma.$transaction([
    prisma.huesped.count({ where }),
    prisma.huesped.findMany({
      where,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
      select: { ...huespedSelect, _count: { select: { reservas: true } } },
    }),
  ]);
  return {
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    huespedes: huespedes.map((h) => ({
      ...presentarHuesped(h, permisos),
      reservas: h._count.reservas,
    })),
  };
}

export async function obtenerHuesped(id: string, permisos: PermisosDatos) {
  const h = await prisma.huesped.findUnique({
    where: { id },
    select: {
      ...huespedSelect,
      consentimientoEn: true,
      versionPolitica: true,
      createdAt: true,
      reservas: {
        orderBy: { fechaEntrada: 'desc' },
        select: { id: true, numero: true, estado: true, fechaEntrada: true, fechaSalida: true },
      },
    },
  });
  if (!h) throw noEncontrado();
  return {
    ...presentarHuesped(h, permisos),
    consentimientoEn: h.consentimientoEn,
    versionPolitica: h.versionPolitica,
    createdAt: h.createdAt,
    reservas: h.reservas.map((r) => ({
      id: r.id,
      codigo: codigoReserva(r.numero),
      estado: r.estado,
      fechaEntrada: deFechaBd(r.fechaEntrada),
      fechaSalida: deFechaBd(r.fechaSalida),
    })),
  };
}

export async function actualizarHuesped(
  id: string,
  datos: ActualizarHuespedInput,
  usuarioId: string,
  permisos: PermisosDatos,
) {
  await prisma.$transaction(async (tx) => {
    await bloquearHuesped(tx, id);
    const actual = await tx.huesped.findUnique({
      where: { id },
      select: { anonimizadoEn: true, telefono: true, email: true },
    });
    if (!actual) throw noEncontrado();
    if (actual.anonimizadoEn) {
      throw new AppError(409, 'Los datos de este huésped fueron suprimidos', 'HUESPED_ANONIMIZADO');
    }
    const telefono = datos.telefono !== undefined ? datos.telefono : actual.telefono;
    const email = datos.email !== undefined ? datos.email : actual.email;
    if (!telefono && !email) {
      throw new AppError(
        422,
        'El huésped debe conservar un teléfono o un correo',
        'CONTACTO_REQUERIDO',
        [{ path: 'telefono', message: 'Indica un teléfono o un correo electrónico' }],
      );
    }
    await tx.huesped.update({ where: { id }, data: datos });
    // Solo los nombres de los campos: la auditoría no guarda datos personales
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'huesped.actualizado',
      entidad: 'huesped',
      entidadId: id,
      datos: { campos: Object.keys(datos) },
    });
  });
  return obtenerHuesped(id, permisos);
}

// Derecho de acceso: todos los datos que el sistema guarda del titular
export async function exportarHuesped(id: string, usuarioId: string) {
  const h = await prisma.huesped.findUnique({
    where: { id },
    select: {
      ...huespedSelect,
      consentimientoEn: true,
      versionPolitica: true,
      createdAt: true,
      updatedAt: true,
      reservas: {
        orderBy: { fechaEntrada: 'desc' },
        select: {
          numero: true,
          estado: true,
          fechaEntrada: true,
          fechaSalida: true,
          cantidadHuespedes: true,
          comentarioHuesped: true,
          createdAt: true,
          canal: { select: { nombre: true } },
        },
      },
    },
  });
  if (!h) throw noEncontrado();
  await prisma.$transaction(async (tx) => {
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'huesped.exportado',
      entidad: 'huesped',
      entidadId: id,
    });
  });
  const { reservas, anonimizadoEn, ...datos } = h;
  return {
    generadoEn: new Date().toISOString(),
    titular: { ...datos, anonimizado: anonimizadoEn !== null },
    reservas: reservas.map((r) => ({
      codigo: codigoReserva(r.numero),
      estado: r.estado,
      fechaEntrada: deFechaBd(r.fechaEntrada),
      fechaSalida: deFechaBd(r.fechaSalida),
      cantidadHuespedes: r.cantidadHuespedes,
      canal: r.canal.nombre,
      comentario: r.comentarioHuesped,
      registradaEn: r.createdAt,
    })),
  };
}

// Derecho de supresión: se reemplazan los datos personales; las reservas conservan su historial
// operativo (fechas, estados) sin identificar a la persona.
export async function anonimizarHuesped(id: string, usuarioId: string) {
  await prisma.$transaction(async (tx) => {
    await bloquearHuesped(tx, id);
    const h = await tx.huesped.findUnique({ where: { id }, select: { anonimizadoEn: true } });
    if (!h) throw noEncontrado();
    if (h.anonimizadoEn) throw new AppError(409, 'El huésped ya fue anonimizado', 'YA_ANONIMIZADO');

    const activas = await tx.reserva.count({
      where: {
        huespedId: id,
        estado: { in: ['SOLICITUD', 'PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'EN_ALOJAMIENTO'] },
      },
    });
    if (activas > 0) {
      throw new AppError(
        409,
        'El huésped tiene reservas vigentes; finalízalas o cancélalas antes de suprimir sus datos',
        'TIENE_RESERVAS_VIGENTES',
      );
    }
    await tx.huesped.update({
      where: { id },
      data: {
        nombres: 'Titular',
        apellidos: 'anonimizado',
        telefono: null,
        email: null,
        tipoDocumento: null,
        numeroDocumento: null,
        anonimizadoEn: new Date(),
      },
    });
    // Los comentarios escritos por el huésped pueden contener datos personales
    // La huella de idempotencia es un hash de nombre, teléfono y correo: también se borra
    await tx.reserva.updateMany({
      where: { huespedId: id },
      data: { comentarioHuesped: null, claveIdempotencia: null, huellaSolicitud: null },
    });
    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'huesped.anonimizado',
      entidad: 'huesped',
      entidadId: id,
    });
  });
}
