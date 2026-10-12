// Sitio público: datos publicados del hotel y solicitudes de reserva.
// Una solicitud NO es una reserva confirmada: entra en estado SOLICITUD, sin camas asignadas,
// y el personal la revisa y confirma desde el panel.

import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { huellaDe } from '../utils/huella.js';
import { aFechaBd, hoyEnHotel, sumarDias } from '../domain/fechas.js';
import { codigoReserva } from '../domain/estadosReserva.js';
import type { SolicitudPublicaInput } from '../schemas/publico.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import { ajustesPublicados, CANAL_WEB } from './configuracion.service.js';
import { esConflictoDeClave, reservaPorClave } from './reservas.service.js';

// Hasta cuántos días en el futuro se reciben solicitudes por el sitio
export const DIAS_MAXIMOS_ANTICIPACION = 540;

// Versión del texto de autorización que acepta la persona en el formulario. Si la administración
// publica su propia política (ajuste tratamiento_datos.version), se registra esa versión.
export const VERSION_AUTORIZACION_BASE = 'base-2026-10';

export async function datosPublicos() {
  const [ajustes, tipos] = await Promise.all([
    ajustesPublicados(),
    prisma.tipoHabitacion.findMany({
      where: { activo: true, publicado: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, descripcion: true, capacidadSugerida: true },
    }),
  ]);
  return {
    ajustes,
    tiposHabitacion: tipos,
    hoy: hoyEnHotel(),
    diasMaximosAnticipacion: DIAS_MAXIMOS_ANTICIPACION,
  };
}

function versionPolitica(ajustes: Awaited<ReturnType<typeof ajustesPublicados>>): string {
  const td = ajustes.tratamiento_datos as { version?: string | null } | undefined;
  return td?.version ?? VERSION_AUTORIZACION_BASE;
}

function respuesta(numero: number) {
  return {
    codigo: codigoReserva(numero),
    estado: 'SOLICITUD' as const,
    mensaje:
      'Recibimos tu solicitud. Aún no es una reserva confirmada: el equipo del hotel revisará la disponibilidad y te contactará.',
  };
}

export async function crearSolicitud(datos: SolicitudPublicaInput, claveIdempotencia: string) {
  // Trampa para robots: se responde igual que un envío correcto, sin guardar nada
  if (datos.sitioWeb && datos.sitioWeb.trim() !== '') {
    return { creada: false, cuerpo: { ...respuesta(0), codigo: null } };
  }

  const hoy = hoyEnHotel();
  if (datos.fechaEntrada < hoy) {
    throw new AppError(400, 'La fecha de llegada no puede ser anterior a hoy', 'FECHA_PASADA', [
      { path: 'fechaEntrada', message: 'Elige una fecha de hoy en adelante' },
    ]);
  }
  if (datos.fechaEntrada > sumarDias(hoy, DIAS_MAXIMOS_ANTICIPACION)) {
    throw new AppError(400, 'La fecha de llegada está demasiado lejos', 'FECHA_MUY_LEJANA', [
      { path: 'fechaEntrada', message: 'Para fechas tan lejanas, contáctanos directamente' },
    ]);
  }

  const { sitioWeb: _trampa, aceptaTratamientoDatos: _acepta, ...contenido } = datos;
  const clave = `pub:${claveIdempotencia}`;
  const huella = huellaDe(contenido);
  const existente = await reservaPorClave(clave, huella);
  if (existente) {
    const r = await prisma.reserva.findUniqueOrThrow({
      where: { id: existente },
      select: { numero: true },
    });
    return { creada: false, cuerpo: respuesta(r.numero) };
  }

  const [canal, ajustes] = await Promise.all([
    prisma.canal.findUnique({ where: { codigo: CANAL_WEB }, select: { id: true, activo: true } }),
    ajustesPublicados(),
  ]);
  if (!canal?.activo) {
    throw new AppError(
      503,
      'Las solicitudes en línea no están disponibles en este momento',
      'SOLICITUDES_NO_DISPONIBLES',
    );
  }
  if (datos.tipoHabitacionId) {
    const tipo = await prisma.tipoHabitacion.findFirst({
      where: { id: datos.tipoHabitacionId, activo: true, publicado: true },
      select: { id: true },
    });
    if (!tipo) {
      throw new AppError(422, 'El tipo de habitación no está disponible', 'TIPO_INVALIDO', [
        { path: 'tipoHabitacionId', message: 'Selecciona otra opción' },
      ]);
    }
  }

  try {
    const numero = await prisma.$transaction(async (tx) => {
      const huesped = await tx.huesped.create({
        data: {
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          telefono: datos.telefono,
          email: datos.email ?? null,
          consentimientoEn: new Date(),
          versionPolitica: versionPolitica(ajustes),
        },
        select: { id: true },
      });
      const reserva = await tx.reserva.create({
        data: {
          estado: 'SOLICITUD',
          canalId: canal.id,
          huespedId: huesped.id,
          fechaEntrada: aFechaBd(datos.fechaEntrada),
          fechaSalida: aFechaBd(datos.fechaSalida),
          cantidadHuespedes: datos.cantidadHuespedes,
          tipoHabitacionPreferidoId: datos.tipoHabitacionId ?? null,
          comentarioHuesped: datos.comentario ?? null,
          claveIdempotencia: clave,
          huellaSolicitud: huella,
        },
        select: { id: true, numero: true },
      });
      await registrarAuditoria(tx, {
        usuarioId: null,
        accion: 'reserva.solicitud_web',
        entidad: 'reserva',
        entidadId: reserva.id,
        datos: {
          estado: 'SOLICITUD',
          fechaEntrada: datos.fechaEntrada,
          fechaSalida: datos.fechaSalida,
          cantidadHuespedes: datos.cantidadHuespedes,
        },
      });
      return reserva.numero;
    });
    return { creada: true, cuerpo: respuesta(numero) };
  } catch (err) {
    if (esConflictoDeClave(err)) {
      const id = await reservaPorClave(clave, huella);
      if (id) {
        const r = await prisma.reserva.findUniqueOrThrow({
          where: { id },
          select: { numero: true },
        });
        return { creada: false, cuerpo: respuesta(r.numero) };
      }
    }
    throw err;
  }
}
