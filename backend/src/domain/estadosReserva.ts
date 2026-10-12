// Flujo de estados de una reserva (docs/adr/0004). Es la ÚNICA definición del flujo: el servicio
// valida cada cambio contra esta tabla y la interfaz la usa para mostrar las acciones posibles.
// Para ajustar el flujo a las reglas que confirme el hotel, se cambia aquí (y sus pruebas).

export const ESTADOS_RESERVA = [
  'SOLICITUD',
  'PENDIENTE_CONFIRMACION',
  'CONFIRMADA',
  'EN_ALOJAMIENTO',
  'FINALIZADA',
  'CANCELADA',
] as const;

export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ETIQUETAS_ESTADO: Record<EstadoReserva, string> = {
  SOLICITUD: 'Solicitud',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADA: 'Confirmada',
  EN_ALOJAMIENTO: 'En alojamiento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const TRANSICIONES: Record<EstadoReserva, readonly EstadoReserva[]> = {
  SOLICITUD: ['PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'CANCELADA'],
  PENDIENTE_CONFIRMACION: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EN_ALOJAMIENTO', 'CANCELADA'],
  EN_ALOJAMIENTO: ['FINALIZADA'],
  FINALIZADA: [],
  CANCELADA: [],
};

export function puedeTransicionar(desde: EstadoReserva, hacia: EstadoReserva): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

// Estados en los que la reserva ocupa camas (sus ocupaciones están activas)
export const ESTADOS_QUE_OCUPAN: readonly EstadoReserva[] = [
  'SOLICITUD',
  'PENDIENTE_CONFIRMACION',
  'CONFIRMADA',
  'EN_ALOJAMIENTO',
  'FINALIZADA',
];

// Estados en los que se pueden asignar o quitar camas
export const ESTADOS_ASIGNABLES: readonly EstadoReserva[] = [
  'SOLICITUD',
  'PENDIENTE_CONFIRMACION',
  'CONFIRMADA',
  'EN_ALOJAMIENTO',
];

// Estados en los que aún se pueden cambiar la fecha de entrada y la cantidad de huéspedes
export const ESTADOS_EDITABLES: readonly EstadoReserva[] = [
  'SOLICITUD',
  'PENDIENTE_CONFIRMACION',
  'CONFIRMADA',
];

// Una solicitud aún no está confirmada: el sitio público nunca la presenta como reserva
export const ESTADOS_PROVISIONALES: readonly EstadoReserva[] = [
  'SOLICITUD',
  'PENDIENTE_CONFIRMACION',
];

export const ESTADOS_CONFIRMADOS: readonly EstadoReserva[] = [
  'CONFIRMADA',
  'EN_ALOJAMIENTO',
  'FINALIZADA',
];

// Condición para confirmar: las camas asignadas deben alcanzar para todos los huéspedes
export function capacidadSuficiente(plazasAsignadas: number, cantidadHuespedes: number): boolean {
  return plazasAsignadas >= cantidadHuespedes && plazasAsignadas > 0;
}

// Código legible: HR-00042
export function codigoReserva(numero: number): string {
  return `HR-${String(numero).padStart(5, '0')}`;
}

// "HR-00042", "hr42", "42" -> 42; null si no parece un código
export function numeroDesdeCodigo(texto: string): number | null {
  const m = /^(?:hr-?)?0*(\d{1,9})$/i.exec(texto.trim());
  return m ? Number(m[1]) : null;
}
