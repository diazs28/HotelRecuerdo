// Tipos de las respuestas de la API (reflejan backend/src/services/*).

export type EstadoReserva =
  | 'SOLICITUD'
  | 'PENDIENTE_CONFIRMACION'
  | 'CONFIRMADA'
  | 'EN_ALOJAMIENTO'
  | 'FINALIZADA'
  | 'CANCELADA';

export type EstadoCama = 'DISPONIBLE' | 'RETENIDA' | 'OCUPADA' | 'BLOQUEADA' | 'MANTENIMIENTO';
export type EstadoHabitacion = 'DISPONIBLE' | 'PARCIAL' | 'OCUPADA' | 'FUERA_DE_SERVICIO';
export type TipoCama =
  'SENCILLA' | 'SEMIDOBLE' | 'DOBLE' | 'QUEEN' | 'KING' | 'LITERA' | 'AUXILIAR';
export type TipoDocumento = 'CC' | 'CE' | 'PASAPORTE' | 'TI' | 'PPT' | 'OTRO';

export interface Ref {
  id: string;
  nombre: string;
}

export interface Huesped {
  id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string | null;
  datosRestringidos: boolean;
  anonimizado: boolean;
}

export interface CamaAsignada {
  ocupacionId: string;
  camaId: string;
  identificador: string;
  tipo: TipoCama;
  plazas: number;
  habitacionId: string;
  habitacion: string;
  desde: string;
  hasta: string | null;
}

export interface Reserva {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  fechaEntrada: string;
  fechaSalida: string;
  noches: number;
  cantidadHuespedes: number;
  plazasAsignadas: number;
  comentarioHuesped: string | null;
  notasOperativas: string | null;
  confirmadaEn: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  updatedAt: string;
  canal: { id: string; codigo: string; nombre: string };
  tipoHabitacionPreferido: Ref | null;
  responsable: Ref | null;
  creadoPor: Ref | null;
  huesped: Huesped;
  camas: CamaAsignada[];
}

export interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  datos: Record<string, unknown> | null;
  createdAt: string;
  usuario: Ref | null;
}

export interface ReservaDetalle extends Reserva {
  historial: RegistroAuditoria[];
}

export interface Pagina {
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ListaReservas extends Pagina {
  reservas: Reserva[];
}

export interface Cama {
  id: string;
  identificador: string;
  tipo: TipoCama;
  plazas: number;
  activa: boolean;
}

export interface Habitacion {
  id: string;
  numero: string;
  capacidad: number;
  piso: string | null;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  tipoHabitacion: Ref;
  camas: Cama[];
}

export interface Bloqueo {
  id: string;
  tipo: 'BLOQUEO' | 'MANTENIMIENTO';
  alcance: 'CAMA' | 'HABITACION';
  fechaInicio: string;
  fechaFin: string | null;
  motivo: string;
  liberadoEn: string | null;
  createdAt: string;
  habitacion: { id: string; numero: string };
  cama: { id: string; identificador: string } | null;
  creadoPor: Ref;
  liberadoPor: Ref | null;
}

export interface OcupacionMapa {
  id: string;
  tipo: 'RESERVA' | 'BLOQUEO';
  desde: string;
  hasta: string | null;
  reserva: {
    id: string;
    codigo: string;
    estado: EstadoReserva;
    cantidadHuespedes: number;
    titular: string | null;
  } | null;
  bloqueo: { id: string; tipo: 'BLOQUEO' | 'MANTENIMIENTO'; motivo: string } | null;
}

export interface MapaOcupacion {
  desde: string;
  hasta: string;
  habitaciones: Array<{
    id: string;
    numero: string;
    capacidad: number;
    tipoHabitacion: Ref;
    estado: EstadoHabitacion;
    camas: Array<{
      id: string;
      identificador: string;
      tipo: TipoCama;
      plazas: number;
      estado: EstadoCama;
      ocupaciones: OcupacionMapa[];
    }>;
  }>;
}

export interface CamasLibres {
  fechaEntrada: string;
  fechaSalida: string;
  camasLibres: number;
  plazasLibres: number;
  habitaciones: Array<{
    habitacionId: string;
    numero: string;
    capacidad: number;
    tipoHabitacion: Ref;
    completa: boolean;
    camas: Array<{ id: string; identificador: string; tipo: TipoCama; plazas: number }>;
  }>;
}

export interface Indicador {
  clave: string;
  nombre: string;
  valor: number | null;
  unidad: string;
  periodo: string;
  formula: string;
  detalle: Record<string, number>;
}

export interface Tablero {
  hoy: string;
  llegadas: Reserva[];
  salidas: Reserva[];
  pendientes: { total: number; primeras: Reserva[] };
  habitaciones: Record<EstadoHabitacion, number>;
  camas: Record<EstadoCama, number>;
  indicadores: Indicador[];
}

export interface TipoHabitacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  capacidadSugerida: number | null;
  publicado: boolean;
  activo: boolean;
  orden: number;
  _count?: { habitaciones: number };
}

export interface Canal {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

export type ClaveAjuste =
  | 'contacto'
  | 'horarios'
  | 'servicio_desayuno'
  | 'servicio_parqueadero'
  | 'servicio_wifi'
  | 'restaurante'
  | 'politicas'
  | 'tarifas'
  | 'tratamiento_datos';

export interface Ajuste {
  clave: ClaveAjuste;
  etiqueta: string;
  valor: Record<string, unknown>;
  confirmado: boolean;
  publicado: boolean;
  updatedAt: string | null;
  actualizadoPor: Ref | null;
}

export interface Contacto {
  telefono?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  mapaUrl?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

export interface Servicio {
  descripcion?: string | null;
  horario?: string | null;
  condiciones?: string | null;
}

export interface DatosPublicos {
  ajustes: Partial<{
    contacto: Contacto;
    horarios: { entrada?: string | null; salida?: string | null; notas?: string | null };
    servicio_desayuno: Servicio;
    servicio_parqueadero: Servicio;
    servicio_wifi: Servicio;
    restaurante: { descripcion?: string | null; horario?: string | null };
    politicas: Record<string, string | null>;
    tarifas: {
      vigencia?: string | null;
      notas?: string | null;
      items?: Array<{ concepto: string; valor: string }>;
    };
    tratamiento_datos: {
      responsable?: string | null;
      nit?: string | null;
      correoContacto?: string | null;
      politicaUrl?: string | null;
      version?: string | null;
    };
  }>;
  tiposHabitacion: Array<{
    id: string;
    nombre: string;
    descripcion: string | null;
    capacidadSugerida: number | null;
  }>;
  hoy: string;
  diasMaximosAnticipacion: number;
}

export interface DisponibilidadPublica {
  fechaEntrada: string;
  fechaSalida: string;
  noches: number;
  hayDisponibilidad: boolean;
  porTipo: Array<{ tipoHabitacionId: string; nombre: string; disponible: boolean }>;
  aviso: string;
}

export interface UsuarioPersonal {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  rol: { id: string; codigo: string; nombre: string };
}

export interface Roles {
  catalogo: Array<{ codigo: string; descripcion: string }>;
  roles: Array<{
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    usuarios: number;
    permisos: string[];
  }>;
}

export interface HuespedDetalle extends Huesped {
  consentimientoEn: string | null;
  versionPolitica: string | null;
  createdAt: string;
  reservas: Array<{
    id: string;
    codigo: string;
    estado: EstadoReserva;
    fechaEntrada: string;
    fechaSalida: string;
  }>;
}
