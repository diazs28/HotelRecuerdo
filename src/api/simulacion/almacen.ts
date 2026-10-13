// Base de datos simulada de la demostración: vive en memoria y en sessionStorage (solo en la
// pestaña de quien la visita; nada sale del navegador). Se regenera cada día para que las
// llegadas, salidas y ocupación giren siempre alrededor de "hoy".

import type { ClaveAjuste, EstadoReserva, TipoCama, TipoDocumento } from '../tipos';
import { hoyEnHotel } from '../../lib/fechas';
import { generarSemilla } from './semilla';

export interface CamaBd {
  id: string;
  identificador: string;
  tipo: TipoCama;
  plazas: number;
  activa: boolean;
}

export interface HabitacionBd {
  id: string;
  numero: string;
  capacidad: number;
  piso: string | null;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  tipoHabitacionId: string;
  camas: CamaBd[];
}

export interface HuespedBd {
  id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string | null;
  anonimizado: boolean;
  consentimientoEn: string | null;
  versionPolitica: string | null;
  createdAt: string;
}

export interface ReservaBd {
  id: string;
  numero: number;
  estado: EstadoReserva;
  fechaEntrada: string;
  fechaSalida: string;
  cantidadHuespedes: number;
  comentarioHuesped: string | null;
  notasOperativas: string | null;
  confirmadaEn: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  updatedAt: string;
  canalId: string;
  tipoHabitacionPreferidoId: string | null;
  responsableId: string | null;
  creadoPorId: string | null;
  huespedId: string;
}

// Una noche de cama tomada por una reserva o un bloqueo: [desde, hasta), hasta null = sin fin
export interface OcupacionBd {
  id: string;
  camaId: string;
  tipo: 'RESERVA' | 'BLOQUEO';
  reservaId: string | null;
  bloqueoId: string | null;
  desde: string;
  hasta: string | null;
  activa: boolean;
  createdAt: string;
}

export interface BloqueoBd {
  id: string;
  tipo: 'BLOQUEO' | 'MANTENIMIENTO';
  alcance: 'CAMA' | 'HABITACION';
  habitacionId: string;
  camaId: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  motivo: string;
  liberadoEn: string | null;
  createdAt: string;
  creadoPorId: string;
  liberadoPorId: string | null;
}

export interface UsuarioBd {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  rolId: string;
}

export interface RolBd {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

export interface AjusteBd {
  valor: Record<string, unknown>;
  confirmado: boolean;
  publicado: boolean;
  updatedAt: string | null;
  actualizadoPorId: string | null;
}

export interface AuditoriaBd {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  datos: Record<string, unknown> | null;
  createdAt: string;
  usuarioId: string | null;
}

export interface Db {
  version: number;
  generadaEl: string;
  secuencia: number;
  tipos: Array<{
    id: string;
    nombre: string;
    descripcion: string | null;
    capacidadSugerida: number | null;
    publicado: boolean;
    activo: boolean;
    orden: number;
  }>;
  canales: Array<{ id: string; codigo: string; nombre: string; activo: boolean; orden: number }>;
  habitaciones: HabitacionBd[];
  huespedes: HuespedBd[];
  reservas: ReservaBd[];
  ocupaciones: OcupacionBd[];
  bloqueos: BloqueoBd[];
  usuarios: UsuarioBd[];
  roles: RolBd[];
  ajustes: Partial<Record<ClaveAjuste, AjusteBd>>;
  auditoria: AuditoriaBd[];
}

const CLAVE = 'hotel-el-recuerdo.demo';
export const VERSION_DB = 1;

let db: Db | null = null;

function leer(): Db | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as Db;
    return valor.version === VERSION_DB && valor.generadaEl === hoyEnHotel() ? valor : null;
  } catch {
    return null;
  }
}

export function obtenerDb(): Db {
  if (!db) db = leer() ?? generarSemilla(hoyEnHotel());
  return db;
}

export function guardarDb(): void {
  if (!db) return;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(db));
  } catch {
    // Sin almacenamiento los cambios duran mientras la pestaña esté abierta
  }
}

// Vuelve a los datos de ejemplo iniciales
export function reiniciarDb(): void {
  db = generarSemilla(hoyEnHotel());
  guardarDb();
}

export const ahora = () => new Date().toISOString();

let contadorId = 0;
export function nuevoId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `00000000-0000-4000-9000-${String(++contadorId + Date.now())
        .slice(-12)
        .padStart(12, '0')}`;
}
