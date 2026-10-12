// Cambios de estado de una reserva (docs/adr/0004). Cada cambio:
//   1. bloquea la fila de la reserva (dos personas no pueden cambiarla a la vez);
//   2. valida la transición contra src/domain/estadosReserva.ts y sus condiciones;
//   3. actualiza con condición sobre el estado leído (updateMany where estado = actual);
//   4. registra la auditoría en la misma transacción.

import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { aFechaBd, deFechaBd, hoyEnHotel } from '../domain/fechas.js';
import {
  ETIQUETAS_ESTADO,
  capacidadSuficiente,
  puedeTransicionar,
  type EstadoReserva,
} from '../domain/estadosReserva.js';
import type { PermisosDatos } from '../domain/privacidad.js';
import type { CambiarEstadoInput } from '../schemas/reservas.schema.js';
import { registrarAuditoria } from './auditoria.service.js';
import {
  bloquearReserva,
  liberarOcupacionesReserva,
  moverOcupacionesReserva,
} from './ocupaciones.service.js';
import {
  leerReserva,
  plazasAsignadas,
  presentarReserva,
  type ReservaBd,
} from './reservas.presentacion.js';

type Datos = Record<string, string | number | null>;

// Condiciones propias del estado de destino. Devuelve cambios extra y datos para la auditoría.
async function aplicarCondiciones(
  tx: Tx,
  r: ReservaBd,
  destino: EstadoReserva,
  motivo: string | null,
): Promise<{ data: Record<string, unknown>; auditoria: Datos }> {
  const hoy = hoyEnHotel();
  const entrada = deFechaBd(r.fechaEntrada);
  const salida = deFechaBd(r.fechaSalida);

  switch (destino) {
    case 'CONFIRMADA': {
      if (!capacidadSuficiente(plazasAsignadas(r), r.cantidadHuespedes)) {
        throw new AppError(
          409,
          `Para confirmar, asigna camas para ${r.cantidadHuespedes} huésped(es): hay ${plazasAsignadas(r)} plaza(s) asignada(s)`,
          'CAPACIDAD_INSUFICIENTE',
        );
      }
      return { data: { confirmadaEn: new Date() }, auditoria: {} };
    }
    case 'EN_ALOJAMIENTO': {
      if (hoy < entrada || hoy >= salida) {
        throw new AppError(
          409,
          `El ingreso solo se registra entre la fecha de entrada (${entrada}) y la noche anterior a la salida (${salida}); si el huésped llega en otra fecha, cambia primero las fechas`,
          'FECHA_NO_PERMITE_INGRESO',
        );
      }
      return { data: {}, auditoria: {} };
    }
    case 'FINALIZADA': {
      // Salida anticipada: se liberan las noches que no se usarán (la salida pasa a ser hoy)
      if (hoy > entrada && hoy < salida) {
        await moverOcupacionesReserva(tx, r.id, entrada, hoy);
        return {
          data: { fechaSalida: aFechaBd(hoy) },
          auditoria: { salidaAnticipada: hoy, salidaOriginal: salida },
        };
      }
      return { data: {}, auditoria: {} };
    }
    case 'CANCELADA': {
      const liberadas = await liberarOcupacionesReserva(tx, r.id);
      return {
        data: { canceladaEn: new Date(), motivoCancelacion: motivo },
        auditoria: { camasLiberadas: liberadas },
      };
    }
    default:
      return { data: {}, auditoria: {} };
  }
}

export async function cambiarEstado(
  reservaId: string,
  { estado: destino, motivo }: CambiarEstadoInput,
  usuarioId: string,
  permisos: PermisosDatos,
) {
  await prisma.$transaction(async (tx) => {
    await bloquearReserva(tx, reservaId);
    const r = await leerReserva(tx, reservaId);

    if (r.estado === destino) {
      throw new AppError(
        409,
        `La reserva ya está en estado "${ETIQUETAS_ESTADO[destino]}"`,
        'ESTADO_REPETIDO',
      );
    }
    if (!puedeTransicionar(r.estado, destino)) {
      throw new AppError(
        409,
        `No se puede pasar de "${ETIQUETAS_ESTADO[r.estado]}" a "${ETIQUETAS_ESTADO[destino]}"`,
        'TRANSICION_INVALIDA',
        { desde: r.estado, hacia: destino },
      );
    }

    const extra = await aplicarCondiciones(tx, r, destino, motivo ?? null);
    const actualizadas = await tx.reserva.updateMany({
      where: { id: reservaId, estado: r.estado },
      data: { estado: destino, ...extra.data },
    });
    if (actualizadas.count !== 1) {
      throw new AppError(
        409,
        'La reserva cambió mientras se guardaba; recarga e intenta de nuevo',
        'CONFLICTO_CONCURRENTE',
      );
    }

    await registrarAuditoria(tx, {
      usuarioId,
      accion: 'reserva.estado',
      entidad: 'reserva',
      entidadId: reservaId,
      datos: { de: r.estado, a: destino, ...(motivo ? { motivo } : {}), ...extra.auditoria },
    });
  });

  return presentarReserva(await leerReserva(prisma, reservaId), permisos);
}
