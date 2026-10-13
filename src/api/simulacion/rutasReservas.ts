// Rutas simuladas: sitio público, tablero, disponibilidad y reservas (reglas de
// backend/src/services/reservas*.ts, asignaciones.service.ts y domain/estadosReserva.ts).

import type { DetalleValidacion } from '../errors';
import type { EstadoReserva, TipoDocumento } from '../tipos';
import { noches } from '../../lib/fechas';
import { ahora, nuevoId, type Db, type HuespedBd, type ReservaBd } from './almacen';
import {
  camaConHabitacion,
  camasLibres,
  detalleReserva,
  mapaOcupacion,
  ocupacionesVigentes,
  plazasAsignadas,
  presentarReserva,
  seCruzan,
  tablero,
} from './consultas';
import {
  exigir,
  fallo,
  lista,
  noEncontrado,
  numero,
  paginar,
  texto,
  type Contexto,
  type Ruta,
} from './nucleo';

const TRANSICIONES: Record<EstadoReserva, EstadoReserva[]> = {
  SOLICITUD: ['PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'CANCELADA'],
  PENDIENTE_CONFIRMACION: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EN_ALOJAMIENTO', 'CANCELADA'],
  EN_ALOJAMIENTO: ['FINALIZADA'],
  FINALIZADA: [],
  CANCELADA: [],
};
const ETIQUETA: Record<EstadoReserva, string> = {
  SOLICITUD: 'Solicitud',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADA: 'Confirmada',
  EN_ALOJAMIENTO: 'En alojamiento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};
const ASIGNABLES: EstadoReserva[] = [
  'SOLICITUD',
  'PENDIENTE_CONFIRMACION',
  'CONFIRMADA',
  'EN_ALOJAMIENTO',
];

function reservaDe(db: Db, id: string): ReservaBd {
  const r = db.reservas.find((x) => x.id === id);
  if (!r) throw noEncontrado('Reserva');
  return r;
}

export function validarFechas(
  entrada: string | null,
  salida: string | null,
  errores: DetalleValidacion[],
) {
  if (!entrada) errores.push({ path: 'fechaEntrada', message: 'Indica la fecha de entrada' });
  if (!salida) errores.push({ path: 'fechaSalida', message: 'Indica la fecha de salida' });
  else if (entrada && salida <= entrada)
    errores.push({
      path: 'fechaSalida',
      message: 'La fecha de salida debe ser posterior a la de entrada',
    });
  else if (entrada && salida && noches(entrada, salida) > 365)
    errores.push({ path: 'fechaSalida', message: 'La estancia no puede superar 365 noches' });
}

// Ninguna cama puede quedar en dos ocupaciones que se crucen (en la BD real lo garantiza
// la restricción de exclusión ocupaciones_cama_sin_cruce)
export function exigirCamasLibres(
  db: Db,
  camaIds: string[],
  desde: string,
  hasta: string | null,
  excluir?: string,
) {
  const tomadas = camaIds.filter((id) =>
    db.ocupaciones.some(
      (o) =>
        o.camaId === id &&
        o.activa &&
        o.reservaId !== excluir &&
        seCruzan(o.desde, o.hasta, desde, hasta),
    ),
  );
  if (tomadas.length > 0) {
    const nombres = tomadas.map((id) => {
      const x = camaConHabitacion(db, id);
      return x ? `${x.habitacion.numero}-${x.cama.identificador}` : id;
    });
    throw fallo(
      409,
      'CAMA_OCUPADA',
      `Estas camas ya están ocupadas o bloqueadas en esas fechas: ${nombres.join(', ')}`,
    );
  }
}

function camasActivas(db: Db, ids: string[]) {
  const validas = ids.filter((id) => {
    const x = camaConHabitacion(db, id);
    return x && x.cama.activa && x.habitacion.activa;
  });
  if (validas.length !== ids.length)
    throw fallo(422, 'CAMA_INVALIDA', 'Alguna cama no existe o está retirada', [
      { path: 'camaIds', message: 'Selecciona camas activas' },
    ]);
  return validas;
}

function ocuparCamas(db: Db, r: ReservaBd, camaIds: string[], desde: string) {
  for (const camaId of camaIds)
    db.ocupaciones.push({
      id: nuevoId(),
      camaId,
      tipo: 'RESERVA',
      reservaId: r.id,
      bloqueoId: null,
      desde,
      hasta: r.fechaSalida,
      activa: true,
      createdAt: ahora(),
    });
}

// Quita las noches desde "dia" en adelante; si la ocupación no ha empezado, la desactiva
function cortarDesde(db: Db, reservaId: string, dia: string) {
  let n = 0;
  for (const o of db.ocupaciones) {
    if (o.reservaId !== reservaId || !o.activa || (o.hasta !== null && o.hasta <= dia)) continue;
    if (o.desde >= dia) o.activa = false;
    else o.hasta = dia;
    n += 1;
  }
  return n;
}

function cambiarEstado(c: Contexto) {
  const r = reservaDe(c.db, c.params.id!);
  const destino = texto(c.body, 'estado') as EstadoReserva | null;
  const motivo = texto(c.body, 'motivo');
  if (!destino || !(destino in TRANSICIONES))
    throw fallo(422, 'VALIDATION_ERROR', 'Estado inválido', [
      { path: 'estado', message: 'Estado inválido' },
    ]);
  const permiso = destino === 'CANCELADA' ? 'reservas:cancelar' : 'reservas:gestionar';
  if (!c.permisos.includes(permiso))
    throw fallo(403, 'FORBIDDEN', 'No tienes permiso para esta acción');
  if (destino === 'CANCELADA' && !motivo)
    exigir([{ path: 'motivo', message: 'Indica el motivo de la cancelación' }]);
  if (r.estado === destino)
    throw fallo(409, 'ESTADO_REPETIDO', `La reserva ya está en estado "${ETIQUETA[destino]}"`);
  if (!TRANSICIONES[r.estado].includes(destino))
    throw fallo(
      409,
      'TRANSICION_INVALIDA',
      `No se puede pasar de "${ETIQUETA[r.estado]}" a "${ETIQUETA[destino]}"`,
    );

  const datos: Record<string, unknown> = { de: r.estado, a: destino };
  if (destino === 'CONFIRMADA') {
    const plazas = plazasAsignadas(c.db, r);
    if (plazas < r.cantidadHuespedes || plazas === 0)
      throw fallo(
        409,
        'CAPACIDAD_INSUFICIENTE',
        `Para confirmar, asigna camas para ${r.cantidadHuespedes} huésped(es): hay ${plazas} plaza(s) asignada(s)`,
      );
    r.confirmadaEn = ahora();
  } else if (destino === 'EN_ALOJAMIENTO') {
    if (c.hoy < r.fechaEntrada || c.hoy >= r.fechaSalida)
      throw fallo(
        409,
        'FECHA_NO_PERMITE_INGRESO',
        `El ingreso solo se registra entre la fecha de entrada (${r.fechaEntrada}) y la noche anterior a la salida (${r.fechaSalida}); si el huésped llega en otra fecha, cambia primero las fechas`,
      );
  } else if (destino === 'FINALIZADA' && c.hoy < r.fechaSalida) {
    // Salida anticipada: se liberan las noches desde hoy
    datos.salidaAnticipada = c.hoy;
    datos.salidaOriginal = r.fechaSalida;
    datos.camasLiberadas = cortarDesde(c.db, r.id, c.hoy);
    if (c.hoy > r.fechaEntrada) r.fechaSalida = c.hoy;
  } else if (destino === 'CANCELADA') {
    let liberadas = 0;
    for (const o of c.db.ocupaciones) {
      if (o.reservaId !== r.id || !o.activa) continue;
      o.activa = false;
      liberadas += 1;
    }
    r.canceladaEn = ahora();
    r.motivoCancelacion = motivo;
    datos.motivo = motivo;
    datos.camasLiberadas = liberadas;
  }
  r.estado = destino;
  r.updatedAt = ahora();
  c.auditar('reserva.estado', 'reserva', r.id, datos);
  return presentarReserva(c.db, r, c.datos);
}

function crearReserva(c: Contexto) {
  const errores: DetalleValidacion[] = [];
  const entrada = texto(c.body, 'fechaEntrada');
  const salida = texto(c.body, 'fechaSalida');
  validarFechas(entrada, salida, errores);
  const cantidad = numero(c.body, 'cantidadHuespedes') ?? 0;
  if (cantidad < 1)
    errores.push({ path: 'cantidadHuespedes', message: 'Debe haber al menos 1 huésped' });
  const canalId = texto(c.body, 'canalId');
  if (!canalId || !c.db.canales.some((x) => x.id === canalId))
    errores.push({ path: 'canalId', message: 'Selecciona el canal de origen' });
  const h = (c.body.huesped ?? {}) as Record<string, unknown>;
  const nombres = texto(h, 'nombres');
  const apellidos = texto(h, 'apellidos');
  if (!nombres) errores.push({ path: 'huesped.nombres', message: 'Escribe los nombres' });
  if (!apellidos) errores.push({ path: 'huesped.apellidos', message: 'Escribe los apellidos' });
  exigir(errores);
  const camaIds = camasActivas(c.db, lista(c.body, 'camaIds'));
  exigirCamasLibres(c.db, camaIds, entrada!, salida!);

  const huesped: HuespedBd = {
    id: nuevoId(),
    nombres: nombres!,
    apellidos: apellidos!,
    telefono: texto(h, 'telefono'),
    email: texto(h, 'email')?.toLowerCase() ?? null,
    tipoDocumento: texto(h, 'tipoDocumento') as TipoDocumento | null,
    numeroDocumento: texto(h, 'numeroDocumento'),
    anonimizado: false,
    consentimientoEn: null,
    versionPolitica: null,
    createdAt: ahora(),
  };
  c.db.huespedes.push(huesped);
  const estadoInicial =
    texto(c.body, 'estadoInicial') === 'SOLICITUD' ? 'SOLICITUD' : 'PENDIENTE_CONFIRMACION';
  const r: ReservaBd = {
    id: nuevoId(),
    numero: c.db.secuencia++,
    estado: estadoInicial,
    fechaEntrada: entrada!,
    fechaSalida: salida!,
    cantidadHuespedes: cantidad,
    comentarioHuesped: null,
    notasOperativas: texto(c.body, 'notasOperativas'),
    confirmadaEn: null,
    canceladaEn: null,
    motivoCancelacion: null,
    createdAt: ahora(),
    updatedAt: ahora(),
    canalId: canalId!,
    tipoHabitacionPreferidoId: texto(c.body, 'tipoHabitacionPreferidoId'),
    responsableId: texto(c.body, 'responsableId'),
    creadoPorId: c.usuario!.id,
    huespedId: huesped.id,
  };
  c.db.reservas.push(r);
  ocuparCamas(c.db, r, camaIds, r.fechaEntrada);
  c.auditar('reserva.creada', 'reserva', r.id, { camaIds });
  return presentarReserva(c.db, r, c.datos);
}

function editarReserva(c: Contexto) {
  const r = reservaDe(c.db, c.params.id!);
  const editable = ['SOLICITUD', 'PENDIENTE_CONFIRMACION', 'CONFIRMADA'].includes(r.estado);
  if (!editable && r.estado !== 'EN_ALOJAMIENTO')
    throw fallo(409, 'ESTADO_NO_EDITABLE', 'Una reserva finalizada o cancelada no se puede editar');
  const entrada =
    r.estado === 'EN_ALOJAMIENTO'
      ? r.fechaEntrada
      : (texto(c.body, 'fechaEntrada') ?? r.fechaEntrada);
  const salida = texto(c.body, 'fechaSalida') ?? r.fechaSalida;
  const errores: DetalleValidacion[] = [];
  validarFechas(entrada, salida, errores);
  const cantidad = numero(c.body, 'cantidadHuespedes');
  if (cantidad !== null && cantidad < 1)
    errores.push({ path: 'cantidadHuespedes', message: 'Debe haber al menos 1 huésped' });
  exigir(errores);

  const cambianFechas = entrada !== r.fechaEntrada || salida !== r.fechaSalida;
  if (cambianFechas) {
    const vigentes = ocupacionesVigentes(c.db, r);
    exigirCamasLibres(
      c.db,
      vigentes.map((o) => o.camaId),
      entrada,
      salida,
      r.id,
    );
    for (const o of vigentes) {
      if (r.estado !== 'EN_ALOJAMIENTO') o.desde = entrada;
      o.hasta = salida;
    }
    r.fechaEntrada = entrada;
    r.fechaSalida = salida;
  }
  if (cantidad !== null && editable) r.cantidadHuespedes = cantidad;
  for (const k of [
    'canalId',
    'tipoHabitacionPreferidoId',
    'responsableId',
    'notasOperativas',
  ] as const)
    if (Object.hasOwn(c.body, k))
      r[k] = (texto(c.body, k) ?? (k === 'canalId' ? r.canalId : null)) as never;
  r.updatedAt = ahora();
  c.auditar(
    'reserva.actualizada',
    'reserva',
    r.id,
    cambianFechas ? { fechasDespues: [entrada, salida] } : null,
  );
  return presentarReserva(c.db, r, c.datos);
}

function asignarCamas(c: Contexto) {
  const r = reservaDe(c.db, c.params.id!);
  if (!ASIGNABLES.includes(r.estado))
    throw fallo(
      409,
      'ESTADO_NO_PERMITE_ASIGNAR',
      'No se pueden cambiar las camas de una reserva finalizada o cancelada',
    );
  const deHabitaciones = lista(c.body, 'habitacionIds').flatMap(
    (id) =>
      c.db.habitaciones
        .find((h) => h.id === id)
        ?.camas.filter((x) => x.activa)
        .map((x) => x.id) ?? [],
  );
  const pedidas = camasActivas(c.db, [
    ...new Set([...lista(c.body, 'camaIds'), ...deHabitaciones]),
  ]);
  if (pedidas.length === 0)
    exigir([{ path: 'camaIds', message: 'Selecciona al menos una cama o habitación' }]);
  const yaAsignadas = new Set(ocupacionesVigentes(c.db, r).map((o) => o.camaId));
  const nuevas = pedidas.filter((id) => !yaAsignadas.has(id));
  const desde = r.estado === 'EN_ALOJAMIENTO' && c.hoy > r.fechaEntrada ? c.hoy : r.fechaEntrada;
  exigirCamasLibres(c.db, nuevas, desde, r.fechaSalida, r.id);
  ocuparCamas(c.db, r, nuevas, desde);
  if (nuevas.length > 0) c.auditar('reserva.camas_asignadas', 'reserva', r.id, { camaIds: nuevas });
  return presentarReserva(c.db, r, c.datos);
}

function quitarCama(c: Contexto) {
  const r = reservaDe(c.db, c.params.id!);
  if (!ASIGNABLES.includes(r.estado))
    throw fallo(
      409,
      'ESTADO_NO_PERMITE_ASIGNAR',
      'No se pueden cambiar las camas de una reserva finalizada o cancelada',
    );
  const o = ocupacionesVigentes(c.db, r).find((x) => x.camaId === c.params.camaId);
  if (!o) throw noEncontrado('Cama asignada');
  if (o.desde < c.hoy && r.estado === 'EN_ALOJAMIENTO') o.hasta = c.hoy;
  else o.activa = false;
  c.auditar('reserva.cama_liberada', 'reserva', r.id, { camaId: o.camaId });
  return presentarReserva(c.db, r, c.datos);
}

function listar(c: Contexto) {
  const q = String(c.query.q ?? '')
    .trim()
    .toLowerCase();
  const estados = ([] as string[]).concat((c.query.estado as string | string[] | undefined) ?? []);
  const desde = c.query.desde as string | undefined;
  const hasta = c.query.hasta as string | undefined;
  const pagina = Number(c.query.pagina ?? 1);
  const porPagina = Number(c.query.porPagina ?? 25);
  const numeroQ = /^(?:hr-?)?0*(\d{1,9})$/i.exec(q)?.[1];
  const items = c.db.reservas
    .filter((r) => estados.length === 0 || estados.includes(r.estado))
    .filter((r) => !c.query.canalId || r.canalId === c.query.canalId)
    .filter((r) => !hasta || r.fechaEntrada < hasta)
    .filter((r) => !desde || r.fechaSalida > desde)
    .filter((r) => {
      if (!q) return true;
      const h = c.db.huespedes.find((x) => x.id === r.huespedId)!;
      const digitos = q.replace(/\D/g, '');
      return (
        `${h.nombres} ${h.apellidos}`.toLowerCase().includes(q) ||
        (h.email ?? '').includes(q) ||
        (digitos.length >= 4 && (h.telefono ?? '').replace(/\D/g, '').includes(digitos)) ||
        (numeroQ !== undefined && r.numero === Number(numeroQ))
      );
    })
    .sort((a, b) =>
      c.query.orden === 'creacion'
        ? b.createdAt.localeCompare(a.createdAt)
        : a.fechaEntrada.localeCompare(b.fechaEntrada) || a.numero - b.numero,
    );
  return {
    total: items.length,
    pagina,
    porPagina,
    reservas: paginar(items, pagina, porPagina).map((r) => presentarReserva(c.db, r, c.datos)),
  };
}

export const RUTAS_RESERVAS: Ruta[] = [
  {
    metodo: 'GET',
    patron: '/admin/tablero',
    acceso: ['tablero:ver'],
    manejar: (c) => tablero(c.db, c.hoy, c.datos),
  },
  {
    metodo: 'GET',
    patron: '/admin/disponibilidad',
    acceso: ['habitaciones:ver', 'reservas:ver'],
    manejar: (c) =>
      mapaOcupacion(c.db, String(c.query.desde), String(c.query.hasta), c.datos.verContacto),
  },
  {
    metodo: 'GET',
    patron: '/admin/disponibilidad/camas-libres',
    acceso: ['habitaciones:ver', 'reservas:ver'],
    manejar: (c) =>
      camasLibres(
        c.db,
        String(c.query.fechaEntrada),
        String(c.query.fechaSalida),
        (c.query.excluirReservaId as string) || undefined,
      ),
  },
  { metodo: 'GET', patron: '/admin/reservas', acceso: ['reservas:ver'], manejar: listar },
  {
    metodo: 'GET',
    patron: '/admin/reservas/:id',
    acceso: ['reservas:ver'],
    manejar: (c) => detalleReserva(c.db, reservaDe(c.db, c.params.id!), c.datos),
  },
  {
    metodo: 'POST',
    patron: '/admin/reservas',
    acceso: ['reservas:gestionar'],
    manejar: crearReserva,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/reservas/:id',
    acceso: ['reservas:gestionar'],
    manejar: editarReserva,
  },
  {
    metodo: 'POST',
    patron: '/admin/reservas/:id/estado',
    acceso: 'sesion',
    manejar: cambiarEstado,
  },
  {
    metodo: 'POST',
    patron: '/admin/reservas/:id/camas',
    acceso: ['reservas:gestionar'],
    manejar: asignarCamas,
  },
  {
    metodo: 'DELETE',
    patron: '/admin/reservas/:id/camas/:camaId',
    acceso: ['reservas:gestionar'],
    manejar: quitarCama,
  },
];
