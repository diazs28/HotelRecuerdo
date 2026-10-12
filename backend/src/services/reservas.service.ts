import { Prisma } from '../generated/prisma/client.js';
import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { huellaDe } from '../utils/huella.js';
import { esUnicoRepetido } from '../utils/erroresBd.js';
import { aFechaBd } from '../domain/fechas.js';
import { numeroDesdeCodigo } from '../domain/estadosReserva.js';
import type { PermisosDatos } from '../domain/privacidad.js';
import type { CrearReservaInput, ListarReservasQuery } from '../schemas/reservas.schema.js';
import { historialDe, registrarAuditoria } from './auditoria.service.js';
import {
  bloquearCamas,
  conControlDeCruces,
  crearOcupacionesReserva,
} from './ocupaciones.service.js';
import { resolverCamasAsignables } from './asignaciones.service.js';
import {
  leerReserva,
  presentarReserva,
  reservaSelect,
  type ReservaPresentada,
} from './reservas.presentacion.js';

// ---------- Referencias ----------

export async function validarReferencias(
  tx: Tx,
  datos: {
    canalId?: string;
    tipoHabitacionPreferidoId?: string | null;
    responsableId?: string | null;
  },
): Promise<void> {
  if (datos.canalId) {
    const canal = await tx.canal.findUnique({
      where: { id: datos.canalId },
      select: { activo: true },
    });
    if (!canal?.activo) {
      throw new AppError(422, 'El canal de origen no existe o está inactivo', 'CANAL_INVALIDO', [
        { path: 'canalId', message: 'Selecciona un canal activo' },
      ]);
    }
  }
  if (datos.tipoHabitacionPreferidoId) {
    const tipo = await tx.tipoHabitacion.findUnique({
      where: { id: datos.tipoHabitacionPreferidoId },
      select: { activo: true },
    });
    if (!tipo?.activo) {
      throw new AppError(422, 'El tipo de habitación no existe o está inactivo', 'TIPO_INVALIDO', [
        { path: 'tipoHabitacionPreferidoId', message: 'Selecciona un tipo de habitación activo' },
      ]);
    }
  }
  if (datos.responsableId) {
    const u = await tx.usuario.findUnique({
      where: { id: datos.responsableId },
      select: { activo: true },
    });
    if (!u?.activo) {
      throw new AppError(422, 'El responsable no existe o está inactivo', 'RESPONSABLE_INVALIDO', [
        { path: 'responsableId', message: 'Selecciona una persona activa del personal' },
      ]);
    }
  }
}

// ---------- Idempotencia ----------

export interface ResultadoCreacion {
  reserva: ReservaPresentada;
  // true si la misma petición ya se había procesado (no se creó otra reserva)
  repetida: boolean;
}

// Si la clave ya se usó: misma huella -> la reserva existente; huella distinta -> 422
export async function reservaPorClave(clave: string, huella: string): Promise<string | null> {
  const existente = await prisma.reserva.findUnique({
    where: { claveIdempotencia: clave },
    select: { id: true, huellaSolicitud: true },
  });
  if (!existente) return null;
  if (existente.huellaSolicitud !== huella) {
    throw new AppError(
      422,
      'Esta clave de idempotencia ya se usó con datos distintos',
      'IDEMPOTENCY_KEY_REUSED',
    );
  }
  return existente.id;
}

export function esConflictoDeClave(err: unknown): boolean {
  return esUnicoRepetido(err, 'clave_idempotencia');
}

// ---------- Crear ----------

export async function crearReserva(
  datos: CrearReservaInput,
  usuarioId: string,
  claveIdempotencia: string | undefined,
  permisos: PermisosDatos,
): Promise<ResultadoCreacion> {
  const clave = claveIdempotencia ? `usr:${usuarioId}:${claveIdempotencia}` : null;
  const huella = clave ? huellaDe(datos) : null;
  if (clave && huella) {
    const id = await reservaPorClave(clave, huella);
    if (id)
      return { reserva: presentarReserva(await leerReserva(prisma, id), permisos), repetida: true };
  }

  const camas = datos.camaIds?.length ? await resolverCamasAsignables(datos.camaIds, []) : [];

  try {
    const id = await conControlDeCruces(
      () =>
        prisma.$transaction(async (tx) => {
          await validarReferencias(tx, datos);
          const huespedId = datos.huespedId ?? (await crearHuesped(tx, datos));
          if (datos.huespedId) await validarHuespedActivo(tx, datos.huespedId);

          const reserva = await tx.reserva.create({
            data: {
              estado: datos.estadoInicial,
              canalId: datos.canalId,
              huespedId,
              fechaEntrada: aFechaBd(datos.fechaEntrada),
              fechaSalida: aFechaBd(datos.fechaSalida),
              cantidadHuespedes: datos.cantidadHuespedes,
              tipoHabitacionPreferidoId: datos.tipoHabitacionPreferidoId ?? null,
              notasOperativas: datos.notasOperativas ?? null,
              responsableId: datos.responsableId ?? usuarioId,
              creadoPorId: usuarioId,
              claveIdempotencia: clave,
              huellaSolicitud: huella,
            },
            select: { id: true },
          });
          const activas = await bloquearCamas(
            tx,
            camas.map((c) => c.id),
            'compartido',
          );
          if (camas.some((c) => !activas.has(c.id))) {
            throw new AppError(
              409,
              'Alguna cama fue retirada mientras se asignaba',
              'CAMA_INVALIDA',
            );
          }
          await crearOcupacionesReserva(
            tx,
            reserva.id,
            camas.map((c) => c.id),
            datos.fechaEntrada,
            datos.fechaSalida,
          );
          await registrarAuditoria(tx, {
            usuarioId,
            accion: 'reserva.creada',
            entidad: 'reserva',
            entidadId: reserva.id,
            datos: {
              estado: datos.estadoInicial,
              canalId: datos.canalId,
              fechaEntrada: datos.fechaEntrada,
              fechaSalida: datos.fechaSalida,
              cantidadHuespedes: datos.cantidadHuespedes,
              camaIds: camas.map((c) => c.id),
            },
          });
          return reserva.id;
        }),
      {
        camaIds: () => camas.map((c) => c.id),
        inicio: datos.fechaEntrada,
        fin: datos.fechaSalida,
      },
    );
    return { reserva: presentarReserva(await leerReserva(prisma, id), permisos), repetida: false };
  } catch (err) {
    // Carrera: otra petición con la misma clave se guardó primero
    if (clave && huella && esConflictoDeClave(err)) {
      const id = await reservaPorClave(clave, huella);
      if (id)
        return {
          reserva: presentarReserva(await leerReserva(prisma, id), permisos),
          repetida: true,
        };
    }
    throw err;
  }
}

async function crearHuesped(tx: Tx, datos: CrearReservaInput): Promise<string> {
  const h = datos.huesped;
  if (!h) throw new AppError(422, 'Faltan los datos del huésped', 'HUESPED_REQUERIDO');
  const creado = await tx.huesped.create({
    data: {
      nombres: h.nombres,
      apellidos: h.apellidos,
      telefono: h.telefono ?? null,
      email: h.email ?? null,
      tipoDocumento: h.tipoDocumento ?? null,
      numeroDocumento: h.numeroDocumento ?? null,
    },
    select: { id: true },
  });
  return creado.id;
}

async function validarHuespedActivo(tx: Tx, huespedId: string): Promise<void> {
  // Bloqueo compartido: el huésped no puede anonimizarse mientras se le crea una reserva
  const filas = await tx.$queryRaw<Array<{ anonimizado_en: Date | null }>>(
    Prisma.sql`SELECT anonimizado_en FROM huespedes WHERE id = ${huespedId}::uuid FOR SHARE`,
  );
  const h = filas[0] ? { anonimizadoEn: filas[0].anonimizado_en } : null;
  if (!h) {
    throw new AppError(422, 'El huésped no existe', 'HUESPED_INVALIDO', [
      { path: 'huespedId', message: 'Selecciona un huésped existente' },
    ]);
  }
  if (h.anonimizadoEn) {
    throw new AppError(409, 'Los datos de este huésped fueron suprimidos', 'HUESPED_ANONIMIZADO');
  }
}

// ---------- Consultar ----------

export async function obtenerReserva(id: string, permisos: PermisosDatos) {
  const r = await leerReserva(prisma, id);
  return { ...presentarReserva(r, permisos), historial: await historialDe('reserva', id) };
}

function filtroBusqueda(q: string): Prisma.ReservaWhereInput {
  const numero = numeroDesdeCodigo(q);
  const digitos = q.replace(/\D/g, '');
  const condiciones: Prisma.ReservaWhereInput[] = [
    { huesped: { nombres: { contains: q, mode: 'insensitive' } } },
    { huesped: { apellidos: { contains: q, mode: 'insensitive' } } },
    { huesped: { email: { contains: q.toLowerCase() } } },
  ];
  // "Ana Pérez": nombre y apellido por separado
  const [primera, ...resto] = q.split(/\s+/);
  if (primera && resto.length > 0) {
    condiciones.push({
      huesped: {
        nombres: { contains: primera, mode: 'insensitive' },
        apellidos: { contains: resto.join(' '), mode: 'insensitive' },
      },
    });
  }
  if (digitos.length >= 4) condiciones.push({ huesped: { telefono: { contains: digitos } } });
  if (numero !== null) condiciones.push({ numero });
  return { OR: condiciones };
}

export async function listarReservas(filtros: ListarReservasQuery, permisos: PermisosDatos) {
  const where: Prisma.ReservaWhereInput = {
    ...(filtros.estado ? { estado: { in: filtros.estado } } : {}),
    ...(filtros.canalId ? { canalId: filtros.canalId } : {}),
    ...(filtros.hasta ? { fechaEntrada: { lt: aFechaBd(filtros.hasta) } } : {}),
    ...(filtros.desde ? { fechaSalida: { gt: aFechaBd(filtros.desde) } } : {}),
    ...(filtros.q ? filtroBusqueda(filtros.q) : {}),
  };
  const orderBy: Prisma.ReservaOrderByWithRelationInput[] =
    filtros.orden === 'creacion'
      ? [{ createdAt: 'desc' }]
      : [{ fechaEntrada: 'asc' }, { numero: 'asc' }];

  const [total, reservas] = await prisma.$transaction([
    prisma.reserva.count({ where }),
    prisma.reserva.findMany({
      where,
      orderBy,
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
      select: reservaSelect,
    }),
  ]);
  return {
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    reservas: reservas.map((r) => presentarReserva(r, permisos)),
  };
}
