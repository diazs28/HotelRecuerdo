// Error tipado de la API. El backend responde { error: { code, message, details? } }.

export interface DetalleValidacion {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: DetalleValidacion[];

  constructor(status: number, code: string, message: string, details: DetalleValidacion[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // Errores por campo de formulario: { fechaSalida: 'La fecha de salida...', ... }
  erroresPorCampo(): Record<string, string> {
    const r: Record<string, string> = {};
    for (const d of this.details) if (d.path && !r[d.path]) r[d.path] = d.message;
    return r;
  }
}

export function esApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// Mensajes propios para errores técnicos; los 4xx del backend ya están redactados para el usuario
const MENSAJES: Record<string, string> = {
  NETWORK_ERROR: 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  RATE_LIMITED: 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.',
  UNAUTHORIZED: 'Inicia sesión para continuar.',
  INVALID_TOKEN: 'Tu sesión terminó. Inicia sesión de nuevo.',
  INTERNAL_ERROR: 'Algo falló en el servidor. Inténtalo de nuevo en unos minutos.',
};

export function mensajeAmigable(status: number, code: string, mensajeServidor?: string): string {
  if (code === 'RATE_LIMITED' && mensajeServidor) return mensajeServidor;
  if (MENSAJES[code]) return MENSAJES[code];
  if (status >= 500 || status === 0) return MENSAJES.INTERNAL_ERROR!;
  return mensajeServidor || 'No fue posible completar la solicitud.';
}

export function mensajeDeError(e: unknown): string {
  if (esApiError(e)) return e.message;
  return MENSAJES.INTERNAL_ERROR!;
}
