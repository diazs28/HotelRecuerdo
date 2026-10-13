// Rutas simuladas del sitio público: datos publicados, disponibilidad orientativa y solicitudes.
// Una solicitud enviada desde el sitio aparece en el panel de la demostración.

import type { DetalleValidacion } from '../errors';
import { noches } from '../../lib/fechas';
import { ahora, nuevoId, type ReservaBd } from './almacen';
import { camasLibres } from './consultas';
import { exigir, numero, texto, type Contexto, type Ruta } from './nucleo';
import { validarFechas } from './rutasReservas';

function solicitudPublica(c: Contexto) {
  const errores: DetalleValidacion[] = [];
  const entrada = texto(c.body, 'fechaEntrada');
  const salida = texto(c.body, 'fechaSalida');
  validarFechas(entrada, salida, errores);
  if (entrada && entrada < c.hoy)
    errores.push({ path: 'fechaEntrada', message: 'La llegada no puede ser anterior a hoy' });
  if (!texto(c.body, 'nombres')) errores.push({ path: 'nombres', message: 'Escribe tu nombre' });
  if (!texto(c.body, 'apellidos'))
    errores.push({ path: 'apellidos', message: 'Escribe tu apellido' });
  if (!texto(c.body, 'telefono'))
    errores.push({ path: 'telefono', message: 'Escribe un teléfono de contacto' });
  if (c.body.aceptaTratamientoDatos !== true)
    errores.push({
      path: 'aceptaTratamientoDatos',
      message: 'Necesitamos tu autorización para responder la solicitud',
    });
  exigir(errores);
  const mensaje =
    'Versión de demostración: la solicitud quedó en el panel de ejemplo, no se envió al hotel.';
  if (texto(c.body, 'sitioWeb')) return { codigo: null, estado: 'SOLICITUD', mensaje };

  const huespedId = nuevoId();
  c.db.huespedes.push({
    id: huespedId,
    nombres: texto(c.body, 'nombres')!,
    apellidos: texto(c.body, 'apellidos')!,
    telefono: texto(c.body, 'telefono'),
    email: texto(c.body, 'email')?.toLowerCase() ?? null,
    tipoDocumento: null,
    numeroDocumento: null,
    anonimizado: false,
    consentimientoEn: ahora(),
    versionPolitica: 'demo',
    createdAt: ahora(),
  });
  const r: ReservaBd = {
    id: nuevoId(),
    numero: c.db.secuencia++,
    estado: 'SOLICITUD',
    fechaEntrada: entrada!,
    fechaSalida: salida!,
    cantidadHuespedes: Math.max(1, numero(c.body, 'cantidadHuespedes') ?? 1),
    comentarioHuesped: texto(c.body, 'comentario'),
    notasOperativas: null,
    confirmadaEn: null,
    canceladaEn: null,
    motivoCancelacion: null,
    createdAt: ahora(),
    updatedAt: ahora(),
    canalId: c.db.canales.find((x) => x.codigo === 'web')!.id,
    tipoHabitacionPreferidoId: texto(c.body, 'tipoHabitacionId'),
    responsableId: null,
    creadoPorId: null,
    huespedId,
  };
  c.db.reservas.push(r);
  c.auditar('reserva.solicitud_web', 'reserva', r.id);
  return { codigo: `HR-${String(r.numero).padStart(5, '0')}`, estado: 'SOLICITUD', mensaje };
}

function datosPublicos(c: Contexto) {
  const ajustes: Record<string, unknown> = {};
  for (const [clave, a] of Object.entries(c.db.ajustes))
    if (a?.confirmado && a.publicado) ajustes[clave] = a.valor;
  return {
    ajustes,
    tiposHabitacion: c.db.tipos
      .filter((t) => t.activo && t.publicado)
      .map((t) => ({
        id: t.id,
        nombre: t.nombre,
        descripcion: t.descripcion,
        capacidadSugerida: t.capacidadSugerida,
      })),
    hoy: c.hoy,
    diasMaximosAnticipacion: 540,
  };
}

function disponibilidadPublica(c: Contexto) {
  const entrada = String(c.query.fechaEntrada);
  const salida = String(c.query.fechaSalida);
  const completas = camasLibres(c.db, entrada, salida).habitaciones.filter((h) => h.completa);
  const tipos = c.db.tipos.filter((t) => t.activo && t.publicado);
  return {
    fechaEntrada: entrada,
    fechaSalida: salida,
    noches: noches(entrada, salida),
    hayDisponibilidad:
      completas.reduce((s, h) => s + h.capacidad, 0) >= Number(c.query.cantidadHuespedes ?? 1),
    porTipo: tipos.map((t) => ({
      tipoHabitacionId: t.id,
      nombre: t.nombre,
      disponible: completas.some((h) => h.tipoHabitacion.id === t.id),
    })),
    aviso:
      'Versión de demostración: el resultado sale de la ocupación de ejemplo, no de la del hotel.',
  };
}

export const RUTAS_PUBLICAS: Ruta[] = [
  { metodo: 'GET', patron: '/publico/hotel', acceso: 'publico', manejar: datosPublicos },
  {
    metodo: 'GET',
    patron: '/publico/disponibilidad',
    acceso: 'publico',
    manejar: disponibilidadPublica,
  },
  { metodo: 'POST', patron: '/publico/solicitudes', acceso: 'publico', manejar: solicitudPublica },
];
