import type { EstadoCama, EstadoHabitacion, EstadoReserva, TipoCama } from '../api/tipos';

// Etiquetas y acciones de la interfaz. El flujo real lo valida el servidor
// (backend/src/domain/estadosReserva.ts); aquí solo se muestran los botones que tienen sentido.

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  SOLICITUD: 'Solicitud',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADA: 'Confirmada',
  EN_ALOJAMIENTO: 'En alojamiento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const ESTILO_ESTADO: Record<EstadoReserva, string> = {
  SOLICITUD: 'bg-ocre-claro text-ocre-texto ring-ocre/40',
  PENDIENTE_CONFIRMACION: 'bg-ocre-claro text-ocre-texto ring-ocre/40',
  CONFIRMADA: 'bg-porton-claro text-porton-2 ring-porton/30',
  EN_ALOJAMIENTO: 'bg-porton text-cal ring-porton',
  FINALIZADA: 'bg-cal-2 text-hierro-2 ring-linea',
  CANCELADA: 'bg-ladrillo-claro text-ladrillo ring-ladrillo/30',
};

export interface Accion {
  estado: EstadoReserva;
  texto: string;
  peligro?: boolean;
  permiso: 'reservas:gestionar' | 'reservas:cancelar';
}

const ACCIONES: Record<EstadoReserva, Accion[]> = {
  SOLICITUD: [
    {
      estado: 'PENDIENTE_CONFIRMACION',
      texto: 'Marcar en revisión',
      permiso: 'reservas:gestionar',
    },
    { estado: 'CONFIRMADA', texto: 'Confirmar reserva', permiso: 'reservas:gestionar' },
    { estado: 'CANCELADA', texto: 'Cancelar', peligro: true, permiso: 'reservas:cancelar' },
  ],
  PENDIENTE_CONFIRMACION: [
    { estado: 'CONFIRMADA', texto: 'Confirmar reserva', permiso: 'reservas:gestionar' },
    { estado: 'CANCELADA', texto: 'Cancelar', peligro: true, permiso: 'reservas:cancelar' },
  ],
  CONFIRMADA: [
    { estado: 'EN_ALOJAMIENTO', texto: 'Registrar llegada', permiso: 'reservas:gestionar' },
    { estado: 'CANCELADA', texto: 'Cancelar', peligro: true, permiso: 'reservas:cancelar' },
  ],
  EN_ALOJAMIENTO: [
    { estado: 'FINALIZADA', texto: 'Registrar salida', permiso: 'reservas:gestionar' },
  ],
  FINALIZADA: [],
  CANCELADA: [],
};

export function accionesDisponibles(estado: EstadoReserva): Accion[] {
  return ACCIONES[estado];
}

export const ETIQUETA_CAMA: Record<EstadoCama, string> = {
  DISPONIBLE: 'Disponible',
  RETENIDA: 'Retenida (sin confirmar)',
  OCUPADA: 'Ocupada',
  BLOQUEADA: 'Bloqueada',
  MANTENIMIENTO: 'En mantenimiento',
};

// Color + patrón: el estado no depende solo del color
export const ESTILO_CAMA: Record<EstadoCama, string> = {
  DISPONIBLE: 'bg-white text-hierro-2 ring-1 ring-linea',
  RETENIDA: 'bg-ocre-claro text-ocre-texto ring-1 ring-ocre/50',
  OCUPADA: 'bg-porton text-cal',
  BLOQUEADA: 'bg-piedra/25 text-hierro rayado',
  MANTENIMIENTO: 'bg-ladrillo-claro text-ladrillo rayado ring-1 ring-ladrillo/40',
};

export const ETIQUETA_HABITACION: Record<EstadoHabitacion, string> = {
  DISPONIBLE: 'Disponible',
  PARCIAL: 'Parcialmente ocupada',
  OCUPADA: 'Ocupada',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
};

export const ETIQUETA_TIPO_CAMA: Record<TipoCama, string> = {
  SENCILLA: 'Sencilla',
  SEMIDOBLE: 'Semidoble',
  DOBLE: 'Doble',
  QUEEN: 'Queen',
  KING: 'King',
  LITERA: 'Litera',
  AUXILIAR: 'Auxiliar',
};

export const TIPOS_CAMA = Object.keys(ETIQUETA_TIPO_CAMA) as TipoCama[];

export const ETIQUETA_DOCUMENTO = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  PASAPORTE: 'Pasaporte',
  TI: 'Tarjeta de identidad',
  PPT: 'Permiso por protección temporal',
  OTRO: 'Otro',
} as const;

// Acciones de la auditoría en lenguaje del personal
export const ETIQUETA_ACCION: Record<string, string> = {
  'reserva.creada': 'Creó la reserva',
  'reserva.solicitud_web': 'Solicitud recibida desde el sitio web',
  'reserva.actualizada': 'Editó la reserva',
  'reserva.estado': 'Cambió el estado',
  'reserva.camas_asignadas': 'Asignó camas',
  'reserva.cama_liberada': 'Quitó una cama',
  'habitacion.creada': 'Creó la habitación',
  'habitacion.actualizada': 'Editó la habitación',
  'habitacion.retirada': 'Retiró la habitación',
  'cama.creada': 'Agregó una cama',
  'cama.actualizada': 'Editó una cama',
  'cama.retirada': 'Retiró una cama',
  'bloqueo.creado': 'Creó un bloqueo',
  'bloqueo.liberado': 'Liberó un bloqueo',
  'huesped.actualizado': 'Editó datos del huésped',
  'huesped.exportado': 'Exportó los datos del huésped',
  'huesped.anonimizado': 'Suprimió los datos del huésped',
  'ajuste.guardado': 'Guardó un dato del hotel',
  'tipo_habitacion.creado': 'Creó un tipo de habitación',
  'tipo_habitacion.actualizado': 'Editó un tipo de habitación',
  'canal.creado': 'Creó un canal',
  'canal.actualizado': 'Editó un canal',
  'usuario.creado': 'Creó un usuario',
  'usuario.actualizado': 'Editó un usuario',
  'rol.permisos': 'Cambió los permisos de un rol',
};
