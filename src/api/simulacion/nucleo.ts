// Tipos y utilidades compartidas por las rutas de la API simulada (sin depender del servidor).

import { ApiError, mensajeAmigable, type DetalleValidacion } from '../errors';
import type { Db, UsuarioBd } from './almacen';
import type { PermisosDatos } from './consultas';

export type ValorQuery = string | number | boolean | undefined | null | readonly string[];
export type Cuerpo = Record<string, unknown>;

export interface Contexto {
  db: Db;
  hoy: string;
  usuario: UsuarioBd | null;
  permisos: string[];
  datos: PermisosDatos;
  params: Record<string, string>;
  query: Record<string, ValorQuery>;
  body: Cuerpo;
  auditar: (accion: string, entidad: string, entidadId: string, datos?: Cuerpo | null) => void;
}

export interface Ruta {
  metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  patron: string;
  // 'publico': sin sesión; 'sesion': cualquier usuario del personal; si no, basta con UNO de los
  // permisos indicados (como requirePermiso del backend)
  acceso: 'publico' | 'sesion' | string[];
  manejar: (c: Contexto) => unknown;
}

export const fallo = (
  status: number,
  code: string,
  message: string,
  details: DetalleValidacion[] = [],
) => new ApiError(status, code, mensajeAmigable(status, code, message), details);

export const noEncontrado = (que: string) => fallo(404, 'NOT_FOUND', `${que} no encontrada`);

// Token de la demo: "demo.<id del usuario>" (no da acceso a nada fuera de esta pestaña)
export const tokenDe = (usuarioId: string) => `demo.${usuarioId}`;

export function permisosDe(db: Db, u: UsuarioBd): string[] {
  return db.roles.find((r) => r.id === u.rolId)?.permisos ?? [];
}

export function usuarioSesion(db: Db, u: UsuarioBd) {
  const rol = db.roles.find((r) => r.id === u.rolId)!;
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: { codigo: rol.codigo, nombre: rol.nombre },
    permisos: [...rol.permisos],
  };
}

// ---------- Lectura del cuerpo ----------

export const texto = (c: Cuerpo, k: string): string | null => {
  const v = c[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
export const numero = (c: Cuerpo, k: string): number | null => {
  const v = Number(c[k]);
  return c[k] === undefined || c[k] === null || Number.isNaN(v) ? null : v;
};
export const lista = (c: Cuerpo, k: string): string[] =>
  Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
export const tiene = (c: Cuerpo, k: string) => Object.hasOwn(c, k);

export function exigir(errores: DetalleValidacion[]) {
  if (errores.length > 0)
    throw fallo(422, 'VALIDATION_ERROR', 'Revisa los datos marcados', errores);
}

export const paginar = <T>(items: T[], pagina: number, porPagina: number) =>
  items.slice((pagina - 1) * porPagina, pagina * porPagina);
