import { ApiError, mensajeAmigable, type DetalleValidacion } from './errors';
import { limpiarSesion, obtenerToken } from './session';
import { MODO_DEMO } from './demo';

// ÚNICO punto del frontend que hace fetch. La API vive en el mismo origen (/api): en desarrollo la
// reenvía Vite y en Docker el contenedor web (nginx).

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type ValorQuery = string | number | boolean | undefined | null | readonly string[];

export interface OpcionesPeticion {
  method?: Metodo;
  body?: unknown;
  query?: Record<string, ValorQuery>;
  // true = envía el token del personal
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

const TIMEOUT_MS = 15_000;

function construirUrl(ruta: string, query?: Record<string, ValorQuery>): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor)) for (const v of valor) params.append(clave, v);
    else params.set(clave, String(valor));
  }
  const qs = params.toString();
  return `/api${ruta}${qs ? `?${qs}` : ''}`;
}

function leerError(cuerpo: unknown) {
  const error = (cuerpo as { error?: Record<string, unknown> } | null)?.error;
  if (!error || typeof error !== 'object') return { details: [] as DetalleValidacion[] };
  const details = Array.isArray(error.details)
    ? (error.details as unknown[]).filter(
        (d): d is DetalleValidacion =>
          !!d &&
          typeof (d as DetalleValidacion).path === 'string' &&
          typeof (d as DetalleValidacion).message === 'string',
      )
    : [];
  return {
    code: typeof error.code === 'string' ? error.code : undefined,
    message: typeof error.message === 'string' ? error.message : undefined,
    details,
  };
}

export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const { method = 'GET', body, query, auth = false, signal } = opciones;
  const headers: Record<string, string> = { ...opciones.headers, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = obtenerToken();
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', mensajeAmigable(401, 'UNAUTHORIZED'));
    headers.Authorization = `Bearer ${token}`;
  }

  // Demostración: responde la API simulada del navegador (sin red ni base de datos)
  if (MODO_DEMO) {
    const { responder } = await import('./simulacion/servidor');
    try {
      return await responder<T>(ruta, { method, body, query, token: obtenerToken() });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && auth) limpiarSesion('expirada');
      throw e;
    }
  }

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      credentials: 'omit', // la sesión va en la cabecera, nunca en cookies
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    const code = (e as Error).name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    throw new ApiError(0, code, mensajeAmigable(0, code));
  }

  if (respuesta.status === 204) return undefined as T;
  const cuerpo: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const { code = `HTTP_${respuesta.status}`, message, details } = leerError(cuerpo);
    // Sesión vencida o invalidada: se cierra en el navegador (la app lleva al ingreso)
    if (respuesta.status === 401 && auth) limpiarSesion('expirada');
    throw new ApiError(
      respuesta.status,
      code,
      mensajeAmigable(respuesta.status, code, message),
      details,
    );
  }
  return cuerpo as T;
}

// Clave de idempotencia por intento de envío: si la red falla y se reintenta, no se duplica
export function nuevaClaveIdempotencia(): string {
  return crypto.randomUUID();
}
