import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { hoyEnHotel, sumarDias } from '../src/domain/fechas.js';
import { sembrarCatalogos, sembrarPermisosYRoles } from '../prisma/semilla.js';

export { prisma };

export interface Servidor {
  url: string;
  cerrar: () => Promise<void>;
}

// Levanta la API real en un puerto libre
export async function iniciarServidor(): Promise<Servidor> {
  const server: Server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/api`,
    cerrar: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// Vacía todas las tablas y carga los datos base. Solo contra una base cuyo nombre contenga "test".
export async function prepararBd(): Promise<void> {
  const nombre = new URL(env.DATABASE_URL).pathname.slice(1);
  if (env.NODE_ENV !== 'test' || !nombre.toLowerCase().includes('test')) {
    throw new Error(`Se negó a vaciar la base "${nombre}": no es una base de pruebas`);
  }
  // TRUNCATE no dispara el trigger de inmutabilidad de la auditoría (es solo para UPDATE/DELETE)
  await prisma.$executeRaw`TRUNCATE auditoria, ocupaciones_cama, bloqueos, reservas, huespedes, camas,
    habitaciones, tipos_habitacion, canales, ajustes, rol_permisos, usuarios, roles, permisos, limites_tasa CASCADE`;
  const log = console.log;
  console.log = () => undefined;
  try {
    await sembrarPermisosYRoles();
    await sembrarCatalogos();
  } finally {
    console.log = log;
  }
}

export interface Respuesta<T = any> {
  status: number;
  body: T;
}

export async function peticion<T = any>(
  base: string,
  metodo: string,
  ruta: string,
  op: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Respuesta<T>> {
  const headers: Record<string, string> = { ...op.headers };
  if (op.token) headers.Authorization = `Bearer ${op.token}`;
  if (op.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers,
    body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
  });
  const texto = await res.text();
  let body: unknown = texto;
  try {
    body = texto ? JSON.parse(texto) : null;
  } catch {
    // respuesta no JSON
  }
  return { status: res.status, body: body as T };
}

// ------------------------------------------------------------
// Datos de prueba
// ------------------------------------------------------------

export const PASSWORD = 'Clave-De-Prueba-Segura-1';

export async function crearUsuario(rolCodigo: 'administrador' | 'recepcion', email?: string) {
  const rol = await prisma.rol.findUniqueOrThrow({ where: { codigo: rolCodigo } });
  return prisma.usuario.create({
    data: {
      nombre: rolCodigo === 'administrador' ? 'Admin Prueba' : 'Recepción Prueba',
      email: email ?? `${rolCodigo}-${randomUUID().slice(0, 8)}@hotel.test`,
      rolId: rol.id,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
}

export async function login(url: string, email: string): Promise<string> {
  const r = await peticion(url, 'POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (r.status !== 200) throw new Error(`login falló: ${r.status}`);
  return r.body.token as string;
}

export async function sesion(url: string, rol: 'administrador' | 'recepcion') {
  const u = await crearUsuario(rol);
  return { usuario: u, token: await login(url, u.email) };
}

let secuencia = 0;

// Habitación con N camas de 1 plaza
export async function crearHabitacion(camas = 2, tipoNombre = 'Doble') {
  secuencia += 1;
  const tipo = await prisma.tipoHabitacion.findUniqueOrThrow({ where: { nombre: tipoNombre } });
  return prisma.habitacion.create({
    data: {
      numero: `T${secuencia}-${randomUUID().slice(0, 4)}`,
      tipoHabitacionId: tipo.id,
      capacidad: camas,
      camas: {
        create: Array.from({ length: camas }, (_, i) => ({
          identificador: String.fromCharCode(65 + i),
          tipo: 'SENCILLA' as const,
          plazas: 1,
        })),
      },
    },
    include: { camas: { orderBy: { identificador: 'asc' } } },
  });
}

export async function canalId(codigo = 'telefono'): Promise<string> {
  return (await prisma.canal.findUniqueOrThrow({ where: { codigo } })).id;
}

// Fecha relativa a hoy en el hotel ("YYYY-MM-DD")
export function dia(desplazamiento: number): string {
  return sumarDias(hoyEnHotel(), desplazamiento);
}

export function huespedNuevo(sufijo = '') {
  return {
    nombres: `Ana${sufijo}`,
    apellidos: 'Pérez Prueba',
    telefono: '3001234567',
    email: `ana${sufijo}@correo.test`,
  };
}

export async function crearReservaApi(
  url: string,
  token: string,
  datos: {
    entrada: string;
    salida: string;
    camaIds?: string[];
    cantidad?: number;
    estadoInicial?: 'SOLICITUD' | 'PENDIENTE_CONFIRMACION';
  },
) {
  return peticion(url, 'POST', '/admin/reservas', {
    token,
    body: {
      huesped: huespedNuevo(String(++secuencia)),
      canalId: await canalId(),
      fechaEntrada: datos.entrada,
      fechaSalida: datos.salida,
      cantidadHuespedes: datos.cantidad ?? 1,
      ...(datos.camaIds ? { camaIds: datos.camaIds } : {}),
      ...(datos.estadoInicial ? { estadoInicial: datos.estadoInicial } : {}),
    },
  });
}
