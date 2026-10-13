// Datos de EJEMPLO de la demostración, generados alrededor de "hoy": la misma distribución de la
// semilla de desarrollo del backend (20 habitaciones, 37 camas), huéspedes ficticios y reservas
// sin cruces de camas. Nada de esto es información real del hotel.

import type { EstadoReserva } from '../tipos';
import { sumarDias } from '../../lib/fechas';
import type { AuditoriaBd, Db, HabitacionBd, HuespedBd, OcupacionBd, ReservaBd } from './almacen';
import { VERSION_DB } from './almacen';
import { ROLES_INICIALES, USUARIOS_DEMO } from './permisos';

// Pseudoaleatorio con semilla: el mismo día genera los mismos datos
function crearAzar(semilla: number) {
  let s = semilla % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const uuid = (grupo: number, n: number) =>
  `00000000-0000-4000-8${String(grupo).padStart(3, '0')}-${String(n).padStart(12, '0')}`;

// Fecha y hora de Bogotá a ISO
const momento = (fecha: string, hora = '10:00') =>
  new Date(`${fecha}T${hora}:00-05:00`).toISOString();

const NOMBRES = [
  'Ana María',
  'Juan Camilo',
  'Luisa',
  'Andrés',
  'Valentina',
  'Santiago',
  'Daniela',
  'Jorge',
  'Camila',
  'Felipe',
  'Natalia',
  'Sebastián',
  'Paula',
  'Diego',
  'Mariana',
  'Óscar',
  'Carolina',
  'Julián',
  'Isabel',
  'Mateo',
  'Lorena',
  'Hernán',
  'Sofía',
  'Ricardo',
];
const APELLIDOS = [
  'Muñoz Paz',
  'Velasco Ortiz',
  'Ruiz Chicangana',
  'Bolaños Díaz',
  'Fernández Guzmán',
  'Castrillón Rojas',
  'Ordóñez Mera',
  'Paredes Cerón',
  'Gómez Ledezma',
  'Zúñiga Torres',
  'Valencia Idrobo',
  'Hurtado Mosquera',
  'Sarria López',
  'Caicedo Ramos',
  'Delgado Erazo',
  'Quintero Solarte',
];
const COMENTARIOS = [
  'Llegamos tarde, hacia las 9 p. m.',
  'Motivo del viaje: salud. Vengo con un acompañante.',
  '¿Tienen parqueadero para un carro?',
  'Motivo del viaje: trabajo. Necesito factura a nombre de la empresa.',
  'Somos un grupo de la universidad.',
  'Motivo del viaje: turismo.',
];
const NOTAS = [
  'Pidió cama cerca a la ventana',
  'Factura a nombre de empresa',
  'Llega en bus nocturno, ingreso temprano si se puede',
  'Cliente frecuente',
  null,
  null,
  null,
];

export function generarSemilla(hoy: string): Db {
  const r = crearAzar(Number(hoy.replaceAll('-', '')));
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(r() * lista.length)]!;
  const creado = momento(sumarDias(hoy, -90));

  const roles = ROLES_INICIALES.map((rol, i) => ({
    id: uuid(1, i + 1),
    ...rol,
    permisos: [...rol.permisos],
  }));
  const usuarios = USUARIOS_DEMO.map((u, i) => ({
    id: uuid(2, i + 1),
    nombre: u.nombre,
    email: u.email,
    activo: true,
    ultimoAcceso: momento(sumarDias(hoy, -1), '18:30'),
    createdAt: creado,
    rolId: roles.find((x) => x.codigo === u.rol)!.id,
  }));
  const [admin, recepcion] = usuarios as [(typeof usuarios)[0], (typeof usuarios)[0]];

  const tipos = ['Sencilla', 'Doble', 'Triple', 'Múltiple / grupos'].map((nombre, i) => ({
    id: uuid(3, i + 1),
    nombre,
    descripcion: null,
    capacidadSugerida: i + 1,
    publicado: false,
    activo: true,
    orden: i + 1,
  }));
  const canales = [
    ['web', 'Sitio web'],
    ['telefono', 'Teléfono'],
    ['whatsapp', 'WhatsApp'],
    ['presencial', 'Presencial'],
    ['correo', 'Correo electrónico'],
    ['agencia', 'Agencia o convenio'],
  ].map(([codigo, nombre], i) => ({
    id: uuid(4, i + 1),
    codigo: codigo!,
    nombre: nombre!,
    activo: true,
    orden: i + 1,
  }));
  const canal = (codigo: string) => canales.find((c) => c.codigo === codigo)!.id;

  // 5 sencillas, 13 dobles con dos camas y 2 triples (igual que la semilla del backend)
  const plan = [...Array(5).fill(0), ...Array(13).fill(1), ...Array(2).fill(2)] as number[];
  let nCama = 0;
  const habitaciones: HabitacionBd[] = plan.map((t, i) => ({
    id: uuid(5, i + 1),
    numero: String(i < 10 ? 101 + i : 201 + (i - 10)),
    capacidad: t + 1,
    piso: i < 10 ? '1' : '2',
    descripcion: 'Distribución de ejemplo de la demostración',
    activa: true,
    orden: i,
    tipoHabitacionId: tipos[t]!.id,
    camas: Array.from({ length: t + 1 }, (_, j) => ({
      id: uuid(6, ++nCama),
      identificador: String.fromCharCode(65 + j),
      tipo: 'SENCILLA' as const,
      plazas: 1,
      activa: true,
    })),
  }));

  const huespedes: HuespedBd[] = Array.from({ length: 46 }, (_, i) => {
    const nombres = elegir(NOMBRES);
    const apellidos = elegir(APELLIDOS);
    const usuarioCorreo = `${nombres.split(' ')[0]!}.${apellidos.split(' ')[0]!}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    return {
      id: uuid(7, i + 1),
      nombres,
      apellidos,
      telefono: `3${String(10 + Math.floor(r() * 20))} 555 ${String(1000 + i * 37).slice(-4)}`,
      email: r() < 0.7 ? `${usuarioCorreo}${i}@example.com` : null,
      tipoDocumento: r() < 0.6 ? 'CC' : null,
      numeroDocumento: null,
      anonimizado: false,
      consentimientoEn: creado,
      versionPolitica: 'demo',
      createdAt: creado,
    };
  });
  huespedes.forEach((h) => {
    if (h.tipoDocumento) h.numeroDocumento = String(10_000_000 + Math.floor(r() * 89_999_999));
  });

  const ocupaciones: OcupacionBd[] = [];
  let nOcup = 0;
  const ocupar = (
    camaId: string,
    desde: string,
    hasta: string | null,
    datos: Partial<OcupacionBd>,
  ) =>
    ocupaciones.push({
      id: uuid(8, ++nOcup),
      camaId,
      tipo: 'RESERVA',
      reservaId: null,
      bloqueoId: null,
      desde,
      hasta,
      activa: true,
      createdAt: momento(desde),
      ...datos,
    });

  // Un mantenimiento de habitación y una cama bloqueada sin fecha de cierre
  const h205 = habitaciones[14]!;
  const h108 = habitaciones[7]!;
  const bloqueos = [
    {
      id: uuid(9, 1),
      tipo: 'MANTENIMIENTO' as const,
      alcance: 'HABITACION' as const,
      habitacionId: h205.id,
      camaId: null,
      fechaInicio: sumarDias(hoy, -1),
      fechaFin: sumarDias(hoy, 3),
      motivo: 'Arreglo de la ducha del baño',
      liberadoEn: null,
      createdAt: momento(sumarDias(hoy, -2), '09:15'),
      creadoPorId: admin.id,
      liberadoPorId: null,
    },
    {
      id: uuid(9, 2),
      tipo: 'BLOQUEO' as const,
      alcance: 'CAMA' as const,
      habitacionId: h108.id,
      camaId: h108.camas[1]!.id,
      fechaInicio: sumarDias(hoy, -4),
      fechaFin: null,
      motivo: 'Colchón en reposición',
      liberadoEn: null,
      createdAt: momento(sumarDias(hoy, -4), '08:40'),
      creadoPorId: recepcion.id,
      liberadoPorId: null,
    },
  ];
  for (const b of bloqueos) {
    const camas = b.camaId
      ? [b.camaId]
      : habitaciones.find((h) => h.id === b.habitacionId)!.camas.map((c) => c.id);
    for (const camaId of camas)
      ocupar(camaId, b.fechaInicio, b.fechaFin, {
        tipo: 'BLOQUEO',
        bloqueoId: b.id,
        createdAt: b.createdAt,
      });
  }

  // ---------- Reservas por habitación, sin cruces ----------
  const reservas: Array<ReservaBd & { camaIds: string[] }> = [];
  const inicio = sumarDias(hoy, -30);
  const fin = sumarDias(hoy, 45);
  for (const h of habitaciones) {
    let cursor = sumarDias(inicio, Math.floor(r() * 4));
    while (cursor < fin) {
      const noches = 1 + Math.floor(r() * 4);
      const salida = sumarDias(cursor, noches);
      if (
        h.id === h205.id &&
        cursor < bloqueos[0]!.fechaFin! &&
        salida > bloqueos[0]!.fechaInicio
      ) {
        cursor = bloqueos[0]!.fechaFin!;
        continue;
      }
      // La cama bloqueada no se asigna mientras dure el bloqueo
      const libres = h.camas.filter(
        (c) => !(c.id === bloqueos[1]!.camaId && salida > bloqueos[1]!.fechaInicio),
      );
      const cantidad = Math.max(
        1,
        Math.min(libres.length, h.capacidad === 1 ? 1 : 1 + Math.floor(r() * h.capacidad)),
      );
      let estado: EstadoReserva;
      if (salida < hoy) estado = r() < 0.08 ? 'CANCELADA' : 'FINALIZADA';
      else if (salida === hoy) estado = 'EN_ALOJAMIENTO';
      else if (cursor < hoy) estado = 'EN_ALOJAMIENTO';
      else if (cursor === hoy) estado = r() < 0.8 ? 'CONFIRMADA' : 'PENDIENTE_CONFIRMACION';
      else {
        // Casi todo lo futuro ya está confirmado; quedan unas pocas por responder
        const x = r();
        estado =
          x < 0.86
            ? 'CONFIRMADA'
            : x < 0.92
              ? 'PENDIENTE_CONFIRMACION'
              : x < 0.95
                ? 'SOLICITUD'
                : 'CANCELADA';
      }
      const deWeb = r() < 0.35;
      const codigoCanal = deWeb
        ? 'web'
        : elegir([
            'whatsapp',
            'whatsapp',
            'telefono',
            'telefono',
            'presencial',
            'correo',
            'agencia',
          ]);
      const diasAntes = 1 + Math.floor(r() * 18);
      let creadaEl = momento(
        sumarDias(cursor, -diasAntes),
        `${String(8 + Math.floor(r() * 11)).padStart(2, '0')}:${r() < 0.5 ? '05' : '40'}`,
      );
      if (creadaEl > new Date().toISOString()) creadaEl = momento(sumarDias(hoy, -1), '16:20');
      const conCamas = estado !== 'SOLICITUD' || r() < 0.4;
      reservas.push({
        id: uuid(10, reservas.length + 1),
        numero: 0,
        estado,
        fechaEntrada: cursor,
        fechaSalida: salida,
        cantidadHuespedes: cantidad,
        comentarioHuesped: deWeb && r() < 0.6 ? elegir(COMENTARIOS) : null,
        notasOperativas: elegir(NOTAS),
        confirmadaEn: ['CONFIRMADA', 'EN_ALOJAMIENTO', 'FINALIZADA'].includes(estado)
          ? new Date(Date.parse(creadaEl) + 3_600_000).toISOString()
          : null,
        canceladaEn:
          estado === 'CANCELADA' ? new Date(Date.parse(creadaEl) + 86_400_000).toISOString() : null,
        motivoCancelacion:
          estado === 'CANCELADA'
            ? elegir([
                'Cambio de planes del huésped',
                'El huésped cambió de fechas',
                'Viaje aplazado',
              ])
            : null,
        createdAt: creadaEl,
        updatedAt: creadaEl,
        canalId: canal(codigoCanal),
        tipoHabitacionPreferidoId: r() < 0.5 ? h.tipoHabitacionId : null,
        responsableId: r() < 0.4 ? recepcion.id : null,
        creadoPorId: deWeb ? null : r() < 0.7 ? recepcion.id : admin.id,
        huespedId: elegir(huespedes).id,
        camaIds: conCamas ? libres.slice(0, cantidad).map((c) => c.id) : [],
      });
      cursor = sumarDias(
        salida,
        Math.floor(r() * 3) + (r() < 0.3 ? 2 : 0) + (cursor > sumarDias(hoy, 15) ? 2 : 0),
      );
    }
  }

  // Solicitudes recientes del sitio web, aún sin camas (bandeja de pendientes del tablero)
  for (let i = 0; i < 4; i++) {
    const entrada = sumarDias(hoy, 6 + i * 5);
    reservas.push({
      id: uuid(10, reservas.length + 1),
      numero: 0,
      estado: 'SOLICITUD',
      fechaEntrada: entrada,
      fechaSalida: sumarDias(entrada, 2 + i),
      cantidadHuespedes: 1 + (i % 3),
      comentarioHuesped: COMENTARIOS[i] ?? null,
      notasOperativas: null,
      confirmadaEn: null,
      canceladaEn: null,
      motivoCancelacion: null,
      createdAt: momento(sumarDias(hoy, i < 2 ? 0 : -1), i % 2 ? '07:50' : '06:30'),
      updatedAt: momento(sumarDias(hoy, -1)),
      canalId: canal('web'),
      tipoHabitacionPreferidoId: tipos[i % 3]!.id,
      responsableId: null,
      creadoPorId: null,
      huespedId: huespedes[40 + i]!.id,
      camaIds: [],
    });
  }

  // Numeración por orden de llegada y ocupaciones de cada reserva
  reservas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  reservas.forEach((x, i) => {
    x.numero = 101 + i;
    for (const camaId of x.camaIds)
      ocupar(camaId, x.fechaEntrada, x.fechaSalida, {
        reservaId: x.id,
        activa: x.estado !== 'CANCELADA',
        createdAt: x.createdAt,
      });
  });

  const auditoria = generarAuditoria(reservas, recepcion.id, bloqueos);

  return {
    version: VERSION_DB,
    generadaEl: hoy,
    secuencia: 101 + reservas.length,
    tipos,
    canales,
    habitaciones,
    huespedes,
    reservas: reservas.map(({ camaIds: _camaIds, ...x }) => x),
    ocupaciones,
    bloqueos,
    usuarios,
    roles,
    ajustes: {
      contacto: {
        valor: { ciudad: 'Popayán, Cauca' },
        confirmado: false,
        publicado: false,
        updatedAt: creado,
        actualizadoPorId: null,
      },
      servicio_desayuno: {
        valor: {
          horario: '7:00 a 9:30 a. m.',
          descripcion: 'Dato de ejemplo por confirmar con el hotel.',
        },
        confirmado: false,
        publicado: false,
        updatedAt: creado,
        actualizadoPorId: null,
      },
      servicio_parqueadero: {
        valor: { descripcion: 'Dato de ejemplo por confirmar con el hotel.' },
        confirmado: false,
        publicado: false,
        updatedAt: creado,
        actualizadoPorId: null,
      },
      servicio_wifi: {
        valor: { descripcion: 'Dato de ejemplo por confirmar con el hotel.' },
        confirmado: false,
        publicado: false,
        updatedAt: creado,
        actualizadoPorId: null,
      },
    },
    auditoria,
  };
}

// Historial coherente con el estado de cada reserva (solo eventos que ya ocurrieron)
function generarAuditoria(
  reservas: Array<ReservaBd & { camaIds: string[] }>,
  recepcionId: string,
  bloqueos: Array<{ id: string; createdAt: string; creadoPorId: string; tipo: string }>,
): AuditoriaBd[] {
  const eventos: Omit<AuditoriaBd, 'id'>[] = [];
  const ahora = new Date().toISOString();
  const mas = (iso: string, minutos: number) =>
    new Date(Date.parse(iso) + minutos * 60_000).toISOString();
  for (const x of reservas) {
    const base = { entidad: 'reserva', entidadId: x.id };
    const web = x.creadoPorId === null;
    eventos.push({
      ...base,
      accion: web ? 'reserva.solicitud_web' : 'reserva.creada',
      datos: web ? null : { camaIds: x.camaIds },
      createdAt: x.createdAt,
      usuarioId: x.creadoPorId,
    });
    if (web && x.camaIds.length > 0)
      eventos.push({
        ...base,
        accion: 'reserva.camas_asignadas',
        datos: { camaIds: x.camaIds },
        createdAt: mas(x.createdAt, 25),
        usuarioId: recepcionId,
      });
    const inicial: EstadoReserva = web ? 'SOLICITUD' : 'PENDIENTE_CONFIRMACION';
    if (x.confirmadaEn)
      eventos.push({
        ...base,
        accion: 'reserva.estado',
        datos: { de: inicial, a: 'CONFIRMADA' },
        createdAt: x.confirmadaEn,
        usuarioId: recepcionId,
      });
    if (x.estado === 'EN_ALOJAMIENTO' || x.estado === 'FINALIZADA')
      eventos.push({
        ...base,
        accion: 'reserva.estado',
        datos: { de: 'CONFIRMADA', a: 'EN_ALOJAMIENTO' },
        createdAt: momento(x.fechaEntrada, '15:10'),
        usuarioId: recepcionId,
      });
    if (x.estado === 'FINALIZADA')
      eventos.push({
        ...base,
        accion: 'reserva.estado',
        datos: { de: 'EN_ALOJAMIENTO', a: 'FINALIZADA' },
        createdAt: momento(x.fechaSalida, '11:30'),
        usuarioId: recepcionId,
      });
    if (x.estado === 'CANCELADA' && x.canceladaEn)
      eventos.push({
        ...base,
        accion: 'reserva.estado',
        datos: {
          de: inicial,
          a: 'CANCELADA',
          motivo: x.motivoCancelacion,
          camasLiberadas: x.camaIds.length,
        },
        createdAt: x.canceladaEn,
        usuarioId: recepcionId,
      });
  }
  for (const b of bloqueos)
    eventos.push({
      accion: 'bloqueo.creado',
      entidad: 'bloqueo',
      entidadId: b.id,
      datos: { tipo: b.tipo },
      createdAt: b.createdAt,
      usuarioId: b.creadoPorId,
    });
  return eventos
    .filter((e) => e.createdAt <= ahora)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e, i) => ({ id: uuid(11, i + 1), ...e }));
}
