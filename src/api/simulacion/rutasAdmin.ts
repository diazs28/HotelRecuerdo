// Rutas simuladas: habitaciones, camas, bloqueos y huéspedes (reglas de
// backend/src/services/habitaciones, bloqueos y huespedes).

import type { DetalleValidacion } from '../errors';
import type { TipoCama, TipoDocumento } from '../tipos';
import { ahora, nuevoId, type BloqueoBd, type Db, type HabitacionBd } from './almacen';
import { codigoReserva, presentarHuesped, presentarReserva } from './consultas';
import {
  exigir,
  fallo,
  noEncontrado,
  numero,
  paginar,
  texto,
  tiene,
  type Contexto,
  type Ruta,
} from './nucleo';
import { exigirCamasLibres } from './rutasReservas';

const ref = (db: Db, id: string | null) => {
  const u = db.usuarios.find((x) => x.id === id);
  return u ? { id: u.id, nombre: u.nombre } : null;
};

function presentarHabitacion(db: Db, h: HabitacionBd) {
  const tipo = db.tipos.find((t) => t.id === h.tipoHabitacionId)!;
  return {
    id: h.id,
    numero: h.numero,
    capacidad: h.capacidad,
    piso: h.piso,
    descripcion: h.descripcion,
    activa: h.activa,
    orden: h.orden,
    tipoHabitacion: { id: tipo.id, nombre: tipo.nombre },
    camas: h.camas
      .filter((c) => c.activa)
      .sort((a, b) => a.identificador.localeCompare(b.identificador)),
  };
}

function habitacionDe(db: Db, id: string) {
  const h = db.habitaciones.find((x) => x.id === id);
  if (!h) throw noEncontrado('Habitación');
  return h;
}

// Una cama o habitación con reservas de hoy en adelante no se puede retirar
function exigirSinReservasFuturas(db: Db, camaIds: string[], hoy: string, que: string) {
  const conReservas = db.ocupaciones.some(
    (o) =>
      camaIds.includes(o.camaId) && o.activa && o.tipo === 'RESERVA' && (o.hasta ?? '9999') > hoy,
  );
  if (conReservas)
    throw fallo(
      409,
      'TIENE_RESERVAS',
      `${que} tiene reservas de hoy en adelante: reasígnalas antes de retirarla`,
    );
}

function datosHabitacion(c: Contexto, actual?: HabitacionBd) {
  const errores: DetalleValidacion[] = [];
  const numeroHab = texto(c.body, 'numero') ?? actual?.numero ?? null;
  if (!numeroHab) errores.push({ path: 'numero', message: 'Escribe el número de la habitación' });
  else if (c.db.habitaciones.some((h) => h.activa && h.numero === numeroHab && h.id !== actual?.id))
    errores.push({ path: 'numero', message: 'Ya existe una habitación activa con ese número' });
  const tipoId = texto(c.body, 'tipoHabitacionId') ?? actual?.tipoHabitacionId ?? null;
  if (!tipoId || !c.db.tipos.some((t) => t.id === tipoId))
    errores.push({ path: 'tipoHabitacionId', message: 'Elige el tipo de habitación' });
  const capacidad = numero(c.body, 'capacidad') ?? actual?.capacidad ?? 0;
  if (capacidad < 1)
    errores.push({ path: 'capacidad', message: 'La capacidad debe ser al menos 1' });
  exigir(errores);
  return { numero: numeroHab!, tipoHabitacionId: tipoId!, capacidad };
}

function crearHabitacion(c: Contexto) {
  const base = datosHabitacion(c);
  const camas = Array.isArray(c.body.camas) ? (c.body.camas as Array<Record<string, unknown>>) : [];
  const h: HabitacionBd = {
    id: nuevoId(),
    ...base,
    piso: texto(c.body, 'piso'),
    descripcion: texto(c.body, 'descripcion'),
    activa: true,
    orden: c.db.habitaciones.length,
    camas: camas.map((x, i) => ({
      id: nuevoId(),
      identificador: texto(x, 'identificador') ?? String.fromCharCode(65 + i),
      tipo: (texto(x, 'tipo') ?? 'SENCILLA') as TipoCama,
      plazas: numero(x, 'plazas') ?? 1,
      activa: true,
    })),
  };
  c.db.habitaciones.push(h);
  c.auditar('habitacion.creada', 'habitacion', h.id, { numero: h.numero });
  return presentarHabitacion(c.db, h);
}

function editarHabitacion(c: Contexto) {
  const h = habitacionDe(c.db, c.params.id!);
  if (tiene(c.body, 'activa') && c.body.activa === false) {
    exigirSinReservasFuturas(
      c.db,
      h.camas.map((x) => x.id),
      c.hoy,
      'La habitación',
    );
    h.activa = false;
    c.auditar('habitacion.retirada', 'habitacion', h.id, { numero: h.numero });
    return presentarHabitacion(c.db, h);
  }
  if (tiene(c.body, 'activa') && c.body.activa === true) {
    if (c.db.habitaciones.some((x) => x.activa && x.numero === h.numero && x.id !== h.id))
      throw fallo(409, 'NUMERO_REPETIDO', 'Ya hay otra habitación activa con ese número');
    h.activa = true;
  }
  if (tiene(c.body, 'numero') || tiene(c.body, 'capacidad') || tiene(c.body, 'tipoHabitacionId'))
    Object.assign(h, datosHabitacion(c, h));
  if (tiene(c.body, 'piso')) h.piso = texto(c.body, 'piso');
  if (tiene(c.body, 'descripcion')) h.descripcion = texto(c.body, 'descripcion');
  c.auditar('habitacion.actualizada', 'habitacion', h.id, { numero: h.numero });
  return presentarHabitacion(c.db, h);
}

function guardarCama(c: Contexto) {
  const h = habitacionDe(c.db, c.params.id!);
  const cama = c.params.camaId ? h.camas.find((x) => x.id === c.params.camaId) : undefined;
  if (c.params.camaId && !cama) throw noEncontrado('Cama');
  if (cama && c.body.activa === false) {
    exigirSinReservasFuturas(c.db, [cama.id], c.hoy, 'La cama');
    cama.activa = false;
    c.auditar('cama.retirada', 'habitacion', h.id, { identificador: cama.identificador });
    return presentarHabitacion(c.db, h);
  }
  const identificador = texto(c.body, 'identificador') ?? cama?.identificador ?? null;
  const errores: DetalleValidacion[] = [];
  if (!identificador)
    errores.push({ path: 'identificador', message: 'Escribe la letra o el nombre de la cama' });
  else if (h.camas.some((x) => x.activa && x.identificador === identificador && x.id !== cama?.id))
    errores.push({
      path: 'identificador',
      message: 'Ya hay una cama con ese identificador en la habitación',
    });
  const plazas = numero(c.body, 'plazas') ?? cama?.plazas ?? 1;
  if (plazas < 1) errores.push({ path: 'plazas', message: 'Al menos 1 plaza' });
  exigir(errores);
  const tipo = (texto(c.body, 'tipo') ?? cama?.tipo ?? 'SENCILLA') as TipoCama;
  if (cama) Object.assign(cama, { identificador: identificador!, tipo, plazas });
  else h.camas.push({ id: nuevoId(), identificador: identificador!, tipo, plazas, activa: true });
  c.auditar(cama ? 'cama.actualizada' : 'cama.creada', 'habitacion', h.id, { identificador });
  return presentarHabitacion(c.db, h);
}

// ---------- Bloqueos ----------

function presentarBloqueo(db: Db, b: BloqueoBd) {
  const h = db.habitaciones.find((x) => x.id === b.habitacionId)!;
  const cama = b.camaId ? h.camas.find((x) => x.id === b.camaId) : undefined;
  return {
    id: b.id,
    tipo: b.tipo,
    alcance: b.alcance,
    fechaInicio: b.fechaInicio,
    fechaFin: b.fechaFin,
    motivo: b.motivo,
    liberadoEn: b.liberadoEn,
    createdAt: b.createdAt,
    habitacion: { id: h.id, numero: h.numero },
    cama: cama ? { id: cama.id, identificador: cama.identificador } : null,
    creadoPor: ref(db, b.creadoPorId)!,
    liberadoPor: ref(db, b.liberadoPorId),
  };
}

function crearBloqueo(c: Contexto) {
  const h = habitacionDe(c.db, texto(c.body, 'habitacionId') ?? '');
  const camaId = texto(c.body, 'camaId');
  const inicio = texto(c.body, 'fechaInicio');
  const finBloqueo = texto(c.body, 'fechaFin');
  const motivo = texto(c.body, 'motivo');
  const errores: DetalleValidacion[] = [];
  if (!inicio) errores.push({ path: 'fechaInicio', message: 'Indica desde cuándo' });
  if (inicio && finBloqueo && finBloqueo <= inicio)
    errores.push({ path: 'fechaFin', message: 'La fecha final debe ser posterior a la inicial' });
  if (!motivo) errores.push({ path: 'motivo', message: 'Escribe el motivo' });
  if (camaId && !h.camas.some((x) => x.id === camaId && x.activa))
    errores.push({ path: 'camaId', message: 'Elige una cama activa' });
  exigir(errores);
  const camas = camaId ? [camaId] : h.camas.filter((x) => x.activa).map((x) => x.id);
  exigirCamasLibres(c.db, camas, inicio!, finBloqueo);
  const b: BloqueoBd = {
    id: nuevoId(),
    tipo: texto(c.body, 'tipo') === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'BLOQUEO',
    alcance: camaId ? 'CAMA' : 'HABITACION',
    habitacionId: h.id,
    camaId,
    fechaInicio: inicio!,
    fechaFin: finBloqueo,
    motivo: motivo!,
    liberadoEn: null,
    createdAt: ahora(),
    creadoPorId: c.usuario!.id,
    liberadoPorId: null,
  };
  c.db.bloqueos.push(b);
  for (const id of camas)
    c.db.ocupaciones.push({
      id: nuevoId(),
      camaId: id,
      tipo: 'BLOQUEO',
      reservaId: null,
      bloqueoId: b.id,
      desde: b.fechaInicio,
      hasta: b.fechaFin,
      activa: true,
      createdAt: ahora(),
    });
  c.auditar('bloqueo.creado', 'bloqueo', b.id, { tipo: b.tipo });
  return presentarBloqueo(c.db, b);
}

function liberarBloqueo(c: Contexto) {
  const b = c.db.bloqueos.find((x) => x.id === c.params.id);
  if (!b) throw noEncontrado('Bloqueo');
  if (b.liberadoEn) throw fallo(409, 'YA_LIBERADO', 'Este bloqueo ya fue liberado');
  for (const o of c.db.ocupaciones) {
    if (o.bloqueoId !== b.id || !o.activa) continue;
    if (o.desde >= c.hoy) o.activa = false;
    else if (o.hasta === null || o.hasta > c.hoy) o.hasta = c.hoy;
  }
  b.liberadoEn = ahora();
  b.liberadoPorId = c.usuario!.id;
  c.auditar('bloqueo.liberado', 'bloqueo', b.id);
  return presentarBloqueo(c.db, b);
}

// ---------- Huéspedes ----------

function huespedDe(c: Contexto) {
  const h = c.db.huespedes.find((x) => x.id === c.params.id);
  if (!h) throw noEncontrado('Huésped');
  return h;
}

function detalleHuesped(c: Contexto) {
  const h = huespedDe(c);
  return {
    ...presentarHuesped(h, c.datos),
    consentimientoEn: h.consentimientoEn,
    versionPolitica: h.versionPolitica,
    createdAt: h.createdAt,
    reservas: c.db.reservas
      .filter((r) => r.huespedId === h.id)
      .sort((a, b) => b.fechaEntrada.localeCompare(a.fechaEntrada))
      .map((r) => ({
        id: r.id,
        codigo: codigoReserva(r.numero),
        estado: r.estado,
        fechaEntrada: r.fechaEntrada,
        fechaSalida: r.fechaSalida,
      })),
  };
}

function listarHuespedes(c: Contexto) {
  const q = String(c.query.q ?? '')
    .trim()
    .toLowerCase();
  const pagina = Number(c.query.pagina ?? 1);
  const items = c.db.huespedes
    .filter(
      (h) =>
        !q ||
        `${h.nombres} ${h.apellidos} ${h.email ?? ''} ${(h.telefono ?? '').replace(/\D/g, '')}`
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombres.localeCompare(b.nombres));
  return {
    total: items.length,
    pagina,
    porPagina: 25,
    huespedes: paginar(items, pagina, 25).map((h) => ({
      ...presentarHuesped(h, c.datos),
      reservas: c.db.reservas.filter((r) => r.huespedId === h.id).length,
    })),
  };
}

function editarHuesped(c: Contexto) {
  const h = huespedDe(c);
  if (h.anonimizado)
    throw fallo(409, 'HUESPED_ANONIMIZADO', 'Los datos de este huésped fueron suprimidos');
  for (const k of ['nombres', 'apellidos'] as const) if (texto(c.body, k)) h[k] = texto(c.body, k)!;
  if (tiene(c.body, 'telefono') && c.datos.verContacto) h.telefono = texto(c.body, 'telefono');
  if (tiene(c.body, 'email') && c.datos.verContacto)
    h.email = texto(c.body, 'email')?.toLowerCase() ?? null;
  if (tiene(c.body, 'numeroDocumento') && c.datos.verDocumento) {
    h.numeroDocumento = texto(c.body, 'numeroDocumento');
    h.tipoDocumento = texto(c.body, 'tipoDocumento') as TipoDocumento | null;
  }
  c.auditar('huesped.actualizado', 'huesped', h.id);
  return detalleHuesped(c);
}

function exportarHuesped(c: Contexto) {
  const h = huespedDe(c);
  c.auditar('huesped.exportado', 'huesped', h.id);
  const completo = { verContacto: true, verDocumento: true };
  return {
    aviso: 'Exportación de la demostración: datos ficticios.',
    exportadoEn: ahora(),
    huesped: {
      ...presentarHuesped(h, completo),
      consentimientoEn: h.consentimientoEn,
      versionPolitica: h.versionPolitica,
    },
    reservas: c.db.reservas
      .filter((r) => r.huespedId === h.id)
      .map((r) => presentarReserva(c.db, r, completo)),
  };
}

function anonimizarHuesped(c: Contexto) {
  const h = huespedDe(c);
  Object.assign(h, {
    nombres: 'Huésped',
    apellidos: 'anonimizado',
    telefono: null,
    email: null,
    tipoDocumento: null,
    numeroDocumento: null,
    anonimizado: true,
  });
  c.auditar('huesped.anonimizado', 'huesped', h.id);
  return undefined;
}

const vigente = (b: BloqueoBd, hoy: string) =>
  !b.liberadoEn && (b.fechaFin === null || b.fechaFin > hoy);

export const RUTAS_ADMIN: Ruta[] = [
  {
    metodo: 'GET',
    patron: '/admin/habitaciones',
    acceso: ['habitaciones:ver'],
    manejar: (c) => {
      const todas = c.query.incluirInactivas === true || c.query.incluirInactivas === 'true';
      const activas = c.db.habitaciones.filter((h) => h.activa);
      const camas = activas.flatMap((h) => h.camas.filter((x) => x.activa));
      return {
        resumen: {
          habitaciones: activas.length,
          camas: camas.length,
          plazas: camas.reduce((s, x) => s + x.plazas, 0),
        },
        habitaciones: (todas ? c.db.habitaciones : activas)
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((h) => presentarHabitacion(c.db, h)),
      };
    },
  },
  {
    metodo: 'POST',
    patron: '/admin/habitaciones',
    acceso: ['habitaciones:gestionar'],
    manejar: crearHabitacion,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/habitaciones/:id',
    acceso: ['habitaciones:gestionar'],
    manejar: editarHabitacion,
  },
  {
    metodo: 'POST',
    patron: '/admin/habitaciones/:id/camas',
    acceso: ['habitaciones:gestionar'],
    manejar: guardarCama,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/habitaciones/:id/camas/:camaId',
    acceso: ['habitaciones:gestionar'],
    manejar: guardarCama,
  },
  {
    metodo: 'GET',
    patron: '/admin/bloqueos',
    acceso: ['habitaciones:ver'],
    manejar: (c) =>
      c.db.bloqueos
        .filter((b) => !c.query.habitacionId || b.habitacionId === c.query.habitacionId)
        .filter(
          (b) => !(c.query.vigentes === true || c.query.vigentes === 'true') || vigente(b, c.hoy),
        )
        .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
        .map((b) => presentarBloqueo(c.db, b)),
  },
  {
    metodo: 'POST',
    patron: '/admin/bloqueos',
    acceso: ['bloqueos:gestionar'],
    manejar: crearBloqueo,
  },
  {
    metodo: 'POST',
    patron: '/admin/bloqueos/:id/liberar',
    acceso: ['bloqueos:gestionar'],
    manejar: liberarBloqueo,
  },
  {
    metodo: 'GET',
    patron: '/admin/huespedes',
    acceso: ['huespedes:ver', 'reservas:ver'],
    manejar: listarHuespedes,
  },
  {
    metodo: 'GET',
    patron: '/admin/huespedes/:id',
    acceso: ['huespedes:ver', 'reservas:ver'],
    manejar: detalleHuesped,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/huespedes/:id',
    acceso: ['reservas:gestionar'],
    manejar: editarHuesped,
  },
  {
    metodo: 'GET',
    patron: '/admin/huespedes/:id/exportar',
    acceso: ['huespedes:gestionar_datos'],
    manejar: exportarHuesped,
  },
  {
    metodo: 'POST',
    patron: '/admin/huespedes/:id/anonimizar',
    acceso: ['huespedes:gestionar_datos'],
    manejar: anonimizarHuesped,
  },
];
