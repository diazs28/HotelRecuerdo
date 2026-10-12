// Sesión del personal: en memoria y en sessionStorage (se borra al cerrar la pestaña).
// NUNCA en localStorage. Solo se guarda el token, su expiración y datos para mostrar.

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: { codigo: string; nombre: string };
  permisos: string[];
}

export interface Sesion {
  token: string;
  expiraEn: string; // ISO 8601
  usuario: UsuarioSesion;
}

const CLAVE = 'hotel-el-recuerdo.sesion';

let memoria: Sesion | null | undefined;
type Oyente = (motivo: 'inicio' | 'cierre' | 'expirada') => void;
const oyentes = new Set<Oyente>();

function esSesionValida(valor: unknown): valor is Sesion {
  if (!valor || typeof valor !== 'object') return false;
  const s = valor as Record<string, unknown>;
  const u = s.usuario as Record<string, unknown> | undefined;
  return (
    typeof s.token === 'string' &&
    typeof s.expiraEn === 'string' &&
    !!u &&
    typeof u.id === 'string' &&
    typeof u.nombre === 'string' &&
    Array.isArray(u.permisos)
  );
}

function vencida(s: Sesion): boolean {
  const t = Date.parse(s.expiraEn);
  return Number.isNaN(t) || t <= Date.now();
}

function leerAlmacen(): Sesion | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const valor: unknown = JSON.parse(crudo);
    return esSesionValida(valor) ? valor : null;
  } catch {
    return null;
  }
}

// Lectura sin efectos (para useSyncExternalStore): misma referencia mientras no cambie
export function sesionActual(): Sesion | null {
  if (memoria === undefined) memoria = leerAlmacen();
  if (!memoria) return null;
  return vencida(memoria) ? null : memoria;
}

export function obtenerToken(): string | null {
  return sesionActual()?.token ?? null;
}

export function guardarSesion(sesion: Sesion): void {
  memoria = sesion;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento la sesión dura mientras la pestaña esté abierta
  }
  for (const o of oyentes) o('inicio');
}

export function actualizarUsuarioSesion(usuario: UsuarioSesion): void {
  const s = sesionActual();
  if (s) guardarSesion({ ...s, usuario });
}

export function limpiarSesion(motivo: 'cierre' | 'expirada' = 'cierre'): void {
  const habia = Boolean(memoria ?? leerAlmacen());
  memoria = null;
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // ignorar
  }
  if (habia) for (const o of oyentes) o(motivo);
}

export function suscribirSesion(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}
