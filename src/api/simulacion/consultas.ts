// Lecturas de la API simulada: misma forma de respuesta que backend/src/services (presentación de
// reservas, mapa de ocupación, camas libres y tablero). Funciones puras sobre la base simulada.

import type {
  CamasLibres,
  EstadoCama,
  EstadoHabitacion,
  EstadoReserva,
  MapaOcupacion,
  Reserva,
  ReservaDetalle,
  Tablero,
} from '../tipos';
import { noches, sumarDias } from '../../lib/fechas';
import type { Db, HuespedBd, OcupacionBd, ReservaBd } from './almacen';

export interface PermisosDatos {
  verContacto: boolean;
  verDocumento: boolean;
}

export const codigoReserva = (n: number) => `HR-${String(n).padStart(5, '0')}`;
export const ESTADOS_CONFIRMADOS: EstadoReserva[] = ['CONFIRMADA', 'EN_ALOJAMIENTO', 'FINALIZADA'];
export const ESTADOS_PROVISIONALES: EstadoReserva[] = ['SOLICITUD', 'PENDIENTE_CONFIRMACION'];

// [a1, a2) se cruza con [b1, b2); null = sin fin
export const seCruzan = (a1: string, a2: string | null, b1: string, b2: string | null) =>
  a1 < (b2 ?? '9999-12-31') && b1 < (a2 ?? '9999-12-31');

const enmascarar = (v: string | null, visibles = 2) => {
  if (v === null) return null;
  const limpio = v.trim();
  if (limpio.length <= visibles) return '•'.repeat(limpio.length);
  return '•'.repeat(Math.min(limpio.length - visibles, 8)) + limpio.slice(-visibles);
};

export function presentarHuesped(h: HuespedBd, p: PermisosDatos) {
  return {
    id: h.id,
    nombres: h.nombres,
    apellidos: h.apellidos,
    telefono: p.verContacto ? h.telefono : enmascarar(h.telefono),
    email: p.verContacto
      ? h.email
      : h.email && `${h.email.slice(0, 1)}•••@${h.email.split('@')[1] ?? ''}`,
    tipoDocumento: h.tipoDocumento,
    numeroDocumento: p.verDocumento ? h.numeroDocumento : enmascarar(h.numeroDocumento, 4),
    datosRestringidos: !p.verContacto || !p.verDocumento,
    anonimizado: h.anonimizado,
  };
}

const ref = (db: Db, id: string | null, lista: 'usuarios' | 'tipos') => {
  if (!id) return null;
  const x = (db[lista] as Array<{ id: string; nombre: string }>).find((e) => e.id === id);
  return x ? { id: x.id, nombre: x.nombre } : null;
};

// Camas vigentes: las que llegan hasta la salida de la reserva
export const ocupacionesVigentes = (db: Db, r: ReservaBd) =>
  db.ocupaciones.filter((o) => o.reservaId === r.id && o.activa && o.hasta === r.fechaSalida);

export function camaConHabitacion(db: Db, camaId: string) {
  for (const h of db.habitaciones) {
    const c = h.camas.find((x) => x.id === camaId);
    if (c) return { cama: c, habitacion: h };
  }
  return null;
}

export const plazasAsignadas = (db: Db, r: ReservaBd) =>
  ocupacionesVigentes(db, r).reduce(
    (s, o) => s + (camaConHabitacion(db, o.camaId)?.cama.plazas ?? 0),
    0,
  );

export function presentarReserva(db: Db, r: ReservaBd, p: PermisosDatos): Reserva {
  const canal = db.canales.find((c) => c.id === r.canalId)!;
  return {
    id: r.id,
    codigo: codigoReserva(r.numero),
    estado: r.estado,
    fechaEntrada: r.fechaEntrada,
    fechaSalida: r.fechaSalida,
    noches: noches(r.fechaEntrada, r.fechaSalida),
    cantidadHuespedes: r.cantidadHuespedes,
    plazasAsignadas: plazasAsignadas(db, r),
    comentarioHuesped: r.comentarioHuesped,
    notasOperativas: r.notasOperativas,
    confirmadaEn: r.confirmadaEn,
    canceladaEn: r.canceladaEn,
    motivoCancelacion: r.motivoCancelacion,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    canal: { id: canal.id, codigo: canal.codigo, nombre: canal.nombre },
    tipoHabitacionPreferido: ref(db, r.tipoHabitacionPreferidoId, 'tipos'),
    responsable: ref(db, r.responsableId, 'usuarios'),
    creadoPor: ref(db, r.creadoPorId, 'usuarios'),
    huesped: presentarHuesped(
      db.huespedes.find((h) => h.id === r.huespedId)!,
      p,
    ),
    camas: ocupacionesVigentes(db, r).map((o) => {
      const { cama, habitacion } = camaConHabitacion(db, o.camaId)!;
      return {
        ocupacionId: o.id,
        camaId: cama.id,
        identificador: cama.identificador,
        tipo: cama.tipo,
        plazas: cama.plazas,
        habitacionId: habitacion.id,
        habitacion: habitacion.numero,
        desde: o.desde,
        hasta: o.hasta,
      };
    }),
  };
}

export function historialDe(db: Db, entidad: string, id: string) {
  return db.auditoria
    .filter((a) => a.entidad === entidad && a.entidadId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => ({ ...a, usuario: ref(db, a.usuarioId, 'usuarios') }));
}

export function detalleReserva(db: Db, r: ReservaBd, p: PermisosDatos): ReservaDetalle {
  return { ...presentarReserva(db, r, p), historial: historialDe(db, 'reserva', r.id) };
}

// ---------- Ocupación ----------

function estadoDeOcupacion(db: Db, o: OcupacionBd): EstadoCama {
  if (o.tipo === 'BLOQUEO') {
    const b = db.bloqueos.find((x) => x.id === o.bloqueoId);
    return b?.tipo === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'BLOQUEADA';
  }
  const estado = db.reservas.find((x) => x.id === o.reservaId)?.estado;
  return estado === 'SOLICITUD' || estado === 'PENDIENTE_CONFIRMACION' ? 'RETENIDA' : 'OCUPADA';
}

export function estadoHabitacion(estados: EstadoCama[]): EstadoHabitacion {
  const enServicio = estados.filter((e) => e !== 'BLOQUEADA' && e !== 'MANTENIMIENTO');
  if (enServicio.length === 0) return 'FUERA_DE_SERVICIO';
  const tomadas = enServicio.filter((e) => e === 'OCUPADA' || e === 'RETENIDA').length;
  if (tomadas === 0) return 'DISPONIBLE';
  return tomadas === enServicio.length ? 'OCUPADA' : 'PARCIAL';
}

export function mapaOcupacion(
  db: Db,
  desde: string,
  hasta: string,
  verNombres: boolean,
): MapaOcupacion {
  const habitaciones = db.habitaciones
    .filter((h) => h.activa)
    .sort((a, b) => a.orden - b.orden || a.numero.localeCompare(b.numero))
    .map((h) => {
      const camas = h.camas
        .filter((c) => c.activa)
        .map((c) => {
          const propias = db.ocupaciones
            .filter(
              (o) => o.camaId === c.id && o.activa && seCruzan(o.desde, o.hasta, desde, hasta),
            )
            .sort((a, b) => a.desde.localeCompare(b.desde));
          const ocupaciones = propias.map((o) => {
            const r = o.reservaId ? db.reservas.find((x) => x.id === o.reservaId) : undefined;
            const b = o.bloqueoId ? db.bloqueos.find((x) => x.id === o.bloqueoId) : undefined;
            const hu = r ? db.huespedes.find((x) => x.id === r.huespedId) : undefined;
            return {
              id: o.id,
              tipo: o.tipo,
              desde: o.desde,
              hasta: o.hasta,
              reserva: r
                ? {
                    id: r.id,
                    codigo: codigoReserva(r.numero),
                    estado: r.estado,
                    cantidadHuespedes: r.cantidadHuespedes,
                    titular: verNombres && hu ? `${hu.nombres} ${hu.apellidos}` : null,
                  }
                : null,
              bloqueo: b ? { id: b.id, tipo: b.tipo, motivo: b.motivo } : null,
            };
          });
          const primera = propias.find(
            (o) => o.desde <= desde && (o.hasta === null || desde < o.hasta),
          );
          return {
            id: c.id,
            identificador: c.identificador,
            tipo: c.tipo,
            plazas: c.plazas,
            estado: primera ? estadoDeOcupacion(db, primera) : ('DISPONIBLE' as EstadoCama),
            ocupaciones,
          };
        });
      const tipo = db.tipos.find((t) => t.id === h.tipoHabitacionId)!;
      return {
        id: h.id,
        numero: h.numero,
        capacidad: h.capacidad,
        tipoHabitacion: { id: tipo.id, nombre: tipo.nombre },
        estado: estadoHabitacion(camas.map((c) => c.estado)),
        camas,
      };
    });
  return { desde, hasta, habitaciones };
}

export function camasLibres(
  db: Db,
  entrada: string,
  salida: string,
  excluirReservaId?: string,
): CamasLibres {
  const habitaciones = db.habitaciones
    .filter((h) => h.activa)
    .sort((a, b) => a.orden - b.orden)
    .flatMap((h) => {
      const activas = h.camas.filter((c) => c.activa);
      const libres = activas.filter(
        (c) =>
          !db.ocupaciones.some(
            (o) =>
              o.camaId === c.id &&
              o.activa &&
              (!excluirReservaId || o.reservaId !== excluirReservaId) &&
              seCruzan(o.desde, o.hasta, entrada, salida),
          ),
      );
      if (libres.length === 0) return [];
      const tipo = db.tipos.find((t) => t.id === h.tipoHabitacionId)!;
      return [
        {
          habitacionId: h.id,
          numero: h.numero,
          capacidad: h.capacidad,
          tipoHabitacion: { id: tipo.id, nombre: tipo.nombre },
          completa: libres.length === activas.length,
          camas: libres.map((c) => ({
            id: c.id,
            identificador: c.identificador,
            tipo: c.tipo,
            plazas: c.plazas,
          })),
        },
      ];
    });
  const camas = habitaciones.flatMap((h) => h.camas);
  return {
    fechaEntrada: entrada,
    fechaSalida: salida,
    camasLibres: camas.length,
    plazasLibres: camas.reduce((s, c) => s + c.plazas, 0),
    habitaciones,
  };
}

const porcentaje = (n: number, d: number) => (d <= 0 ? null : Math.round((n / d) * 1000) / 10);

export function tablero(db: Db, hoy: string, p: PermisosDatos): Tablero {
  const DIAS = 30;
  const mapa = mapaOcupacion(db, hoy, sumarDias(hoy, 1), false);
  const camas: Record<EstadoCama, number> = {
    DISPONIBLE: 0,
    RETENIDA: 0,
    OCUPADA: 0,
    BLOQUEADA: 0,
    MANTENIMIENTO: 0,
  };
  const habitaciones: Record<EstadoHabitacion, number> = {
    DISPONIBLE: 0,
    PARCIAL: 0,
    OCUPADA: 0,
    FUERA_DE_SERVICIO: 0,
  };
  for (const h of mapa.habitaciones) {
    habitaciones[h.estado] += 1;
    for (const c of h.camas) camas[c.estado] += 1;
  }
  const totalCamas = mapa.habitaciones.reduce((s, h) => s + h.camas.length, 0);
  const enServicio = totalCamas - camas.BLOQUEADA - camas.MANTENIMIENTO;
  const inicio = sumarDias(hoy, -DIAS);

  // Camas-noche del periodo [inicio, hoy)
  let ocupadas = 0;
  let bloqueadas = 0;
  for (const o of db.ocupaciones) {
    if (!o.activa || !seCruzan(o.desde, o.hasta, inicio, hoy)) continue;
    const d = o.desde > inicio ? o.desde : inicio;
    const h = o.hasta && o.hasta < hoy ? o.hasta : hoy;
    const n = noches(d, h);
    if (o.tipo === 'BLOQUEO') bloqueadas += n;
    else if (
      ESTADOS_CONFIRMADOS.includes(
        db.reservas.find((x) => x.id === o.reservaId)?.estado ?? 'CANCELADA',
      )
    )
      ocupadas += n;
  }
  const disponibles = totalCamas * DIAS - bloqueadas;
  const delPeriodo = db.reservas.filter((x) => x.createdAt.slice(0, 10) >= inicio);
  const convertidas = delPeriodo.filter((x) => ESTADOS_CONFIRMADOS.includes(x.estado)).length;
  const presentar = (r: ReservaBd) => presentarReserva(db, r, p);
  const pendientes = db.reservas
    .filter((x) => ESTADOS_PROVISIONALES.includes(x.estado))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    hoy,
    llegadas: db.reservas
      .filter(
        (x) =>
          x.fechaEntrada === hoy &&
          (x.estado === 'CONFIRMADA' || x.estado === 'PENDIENTE_CONFIRMACION'),
      )
      .sort((a, b) => a.numero - b.numero)
      .map(presentar),
    salidas: db.reservas
      .filter((x) => x.fechaSalida === hoy && x.estado === 'EN_ALOJAMIENTO')
      .sort((a, b) => a.numero - b.numero)
      .map(presentar),
    pendientes: { total: pendientes.length, primeras: pendientes.slice(0, 10).map(presentar) },
    habitaciones,
    camas,
    indicadores: [
      {
        clave: 'ocupacion_hoy',
        nombre: 'Ocupación de camas esta noche',
        valor: porcentaje(camas.OCUPADA, enServicio),
        unidad: '%',
        periodo: `Noche del ${hoy}`,
        formula:
          'Camas ocupadas por reservas confirmadas o en alojamiento ÷ camas en servicio (sin bloqueadas ni en mantenimiento) × 100',
        detalle: { ocupadas: camas.OCUPADA, enServicio },
      },
      {
        clave: 'ocupacion_periodo',
        nombre: `Ocupación de camas, últimos ${DIAS} días`,
        valor: porcentaje(ocupadas, disponibles),
        unidad: '%',
        periodo: `Noches del ${inicio} al ${sumarDias(hoy, -1)}`,
        formula:
          'Camas-noche ocupadas (reservas confirmadas, en alojamiento o finalizadas) ÷ (camas activas hoy × días − camas-noche bloqueadas) × 100',
        detalle: { camasNocheOcupadas: ocupadas, camasNocheDisponibles: disponibles },
      },
      {
        clave: 'conversion',
        nombre: `Conversión de solicitudes, últimos ${DIAS} días`,
        valor: porcentaje(convertidas, delPeriodo.length),
        unidad: '%',
        periodo: `Solicitudes y reservas registradas del ${inicio} al ${hoy}`,
        formula:
          'Registradas en el periodo que hoy están confirmadas, en alojamiento o finalizadas ÷ todas las registradas en el periodo × 100',
        detalle: { recibidas: delPeriodo.length, convertidas },
      },
    ],
  };
}
