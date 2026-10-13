// API simulada de la demostración (VITE_MODO_DEMO=true). api/client.ts le entrega cada petición en
// lugar de usar la red: responde con la misma forma que el backend, aplica sus reglas principales
// (estados, cruces de camas, permisos por rol, datos enmascarados) y guarda todo en la pestaña.

import { hoyEnHotel } from '../../lib/fechas';
import { ahora, guardarDb, nuevoId, obtenerDb, type UsuarioBd } from './almacen';
import {
  fallo,
  permisosDe,
  type Contexto,
  type Cuerpo,
  type Ruta,
  type ValorQuery,
} from './nucleo';
import { RUTAS_ADMIN } from './rutasAdmin';
import { RUTAS_CONFIGURACION } from './rutasConfiguracion';
import { RUTAS_PUBLICAS } from './rutasPublicas';
import { RUTAS_RESERVAS } from './rutasReservas';

const RUTAS: Ruta[] = [
  ...RUTAS_PUBLICAS,
  ...RUTAS_RESERVAS,
  ...RUTAS_ADMIN,
  ...RUTAS_CONFIGURACION,
];

function coincide(patron: string, ruta: string): Record<string, string> | null {
  const a = patron.split('/');
  const b = ruta.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(':')) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

const espera = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 220));

export async function responder<T>(
  ruta: string,
  opciones: {
    method?: Ruta['metodo'];
    body?: unknown;
    query?: Record<string, ValorQuery>;
    token?: string | null;
  },
): Promise<T> {
  await espera();
  const metodo = opciones.method ?? 'GET';
  const db = obtenerDb();
  let encontrada: { ruta: Ruta; params: Record<string, string> } | null = null;
  for (const r of RUTAS) {
    if (r.metodo !== metodo) continue;
    const params = coincide(r.patron, ruta);
    if (params) {
      encontrada = { ruta: r, params };
      break;
    }
  }
  if (!encontrada)
    throw fallo(404, 'NOT_FOUND', 'Esta función no está disponible en la demostración');

  let usuario: UsuarioBd | null = null;
  if (encontrada.ruta.acceso !== 'publico') {
    const id = opciones.token?.startsWith('demo.') ? opciones.token.slice(5) : '';
    usuario = db.usuarios.find((u) => u.id === id && u.activo) ?? null;
    if (!usuario) throw fallo(401, 'INVALID_TOKEN', 'Tu sesión terminó');
  }
  const permisos = usuario ? permisosDe(db, usuario) : [];
  const acceso = encontrada.ruta.acceso;
  if (Array.isArray(acceso) && !acceso.some((p) => permisos.includes(p)))
    throw fallo(403, 'FORBIDDEN', 'No tienes permiso para esta acción');

  const contexto: Contexto = {
    db,
    hoy: hoyEnHotel(),
    usuario,
    permisos,
    datos: {
      verContacto: permisos.includes('huespedes:ver'),
      verDocumento: permisos.includes('huespedes:ver_documento'),
    },
    params: encontrada.params,
    query: opciones.query ?? {},
    body: (opciones.body ?? {}) as Cuerpo,
    auditar: (accion, entidad, entidadId, datos = null) =>
      db.auditoria.unshift({
        id: nuevoId(),
        accion,
        entidad,
        entidadId,
        datos,
        createdAt: ahora(),
        usuarioId: usuario?.id ?? null,
      }),
  };
  const resultado = encontrada.ruta.manejar(contexto);
  guardarDb();
  // Copia: la interfaz nunca recibe referencias a la base simulada
  return (resultado === undefined ? undefined : structuredClone(resultado)) as T;
}
