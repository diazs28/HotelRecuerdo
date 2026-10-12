// Datos base del sistema (idempotentes: se pueden aplicar varias veces sin duplicar ni pisar cambios
// hechos desde el panel). Los usan prisma/seed.ts y scripts/crear-admin.ts.

import type { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import {
  CODIGOS_PERMISO,
  PERMISOS,
  ROLES_INICIALES,
  ROL_ADMINISTRADOR,
} from '../src/domain/permisos.js';

export async function sembrarPermisosYRoles(): Promise<void> {
  for (const codigo of CODIGOS_PERMISO) {
    await prisma.permiso.upsert({
      where: { codigo },
      create: { codigo, descripcion: PERMISOS[codigo] },
      update: { descripcion: PERMISOS[codigo] },
    });
  }
  const permisos = await prisma.permiso.findMany({ select: { id: true, codigo: true } });
  const idPorCodigo = new Map(permisos.map((p) => [p.codigo, p.id]));

  for (const [codigo, rol] of Object.entries(ROLES_INICIALES)) {
    const existente = await prisma.rol.findUnique({ where: { codigo }, select: { id: true } });
    // Un rol existente conserva los permisos que le haya dado el administrador...
    const r =
      existente ??
      (await prisma.rol.create({
        data: { codigo, nombre: rol.nombre, descripcion: rol.descripcion },
        select: { id: true },
      }));
    // ...salvo el administrador, que siempre recibe los permisos nuevos del sistema
    if (!existente || codigo === ROL_ADMINISTRADOR) {
      await prisma.rolPermiso.createMany({
        data: rol.permisos.map((p) => ({ rolId: r.id, permisoId: idPorCodigo.get(p)! })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  · Permisos (${CODIGOS_PERMISO.length}) y roles iniciales listos`);
}

const CANALES = [
  { codigo: 'web', nombre: 'Sitio web', orden: 1 },
  { codigo: 'telefono', nombre: 'Teléfono', orden: 2 },
  { codigo: 'whatsapp', nombre: 'WhatsApp', orden: 3 },
  { codigo: 'presencial', nombre: 'Presencial', orden: 4 },
  { codigo: 'correo', nombre: 'Correo electrónico', orden: 5 },
  { codigo: 'agencia', nombre: 'Agencia o convenio', orden: 6 },
];

// SUPUESTO: tipos genéricos para empezar; la administración los ajusta desde el panel.
const TIPOS_HABITACION = [
  { nombre: 'Sencilla', capacidadSugerida: 1, orden: 1 },
  { nombre: 'Doble', capacidadSugerida: 2, orden: 2 },
  { nombre: 'Triple', capacidadSugerida: 3, orden: 3 },
  { nombre: 'Múltiple / grupos', capacidadSugerida: 4, orden: 4 },
];

// Datos que menciona la caracterización del hotel, guardados SIN confirmar ni publicar:
// la administración debe validarlos antes de que aparezcan en el sitio.
const AJUSTES_POR_CONFIRMAR: Record<string, Prisma.InputJsonValue> = {
  contacto: { ciudad: 'Popayán, Cauca' },
  servicio_desayuno: {
    horario: '7:00 a 9:30 a. m.',
    descripcion: 'Mencionado en la caracterización; confirmar si está incluido y sus condiciones.',
  },
  servicio_parqueadero: {
    descripcion: 'Mencionado en la caracterización; confirmar cupos, costo y horario.',
  },
  servicio_wifi: {
    descripcion: 'Mencionado en la caracterización; confirmar cobertura y condiciones.',
  },
};

export async function sembrarCatalogos(): Promise<void> {
  for (const c of CANALES) {
    await prisma.canal.upsert({ where: { codigo: c.codigo }, create: c, update: {} });
  }
  for (const t of TIPOS_HABITACION) {
    await prisma.tipoHabitacion.upsert({
      where: { nombre: t.nombre },
      create: { ...t, descripcion: 'Tipo inicial: confirmar con la administración' },
      update: {},
    });
  }
  for (const [clave, valor] of Object.entries(AJUSTES_POR_CONFIRMAR)) {
    await prisma.ajuste.upsert({
      where: { clave },
      create: { clave, valor, confirmado: false, publicado: false },
      update: {},
    });
  }
  console.log('  · Canales, tipos de habitación y datos por confirmar listos');
}

// Crea el administrador si su correo no existe; si existe, no se toca (ni nombre ni contraseña)
export async function crearAdministrador(nombre: string, email: string, password: string) {
  const existente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (existente) {
    console.log('  · Administrador: ya existe un usuario con ese correo, no se modifica');
    return false;
  }
  const rol = await prisma.rol.findUniqueOrThrow({
    where: { codigo: ROL_ADMINISTRADOR },
    select: { id: true },
  });
  await prisma.usuario.create({
    data: { nombre, email, rolId: rol.id, passwordHash: await hashPassword(password) },
  });
  console.log('  · Administrador: creado');
  return true;
}

// Distribución de EJEMPLO para desarrollo: 20 habitaciones y 37 camas (las cifras de la
// caracterización). NO es la distribución real: se reemplaza desde el panel.
export async function sembrarDistribucionDeEjemplo(): Promise<void> {
  const tipos = await prisma.tipoHabitacion.findMany({ select: { id: true, nombre: true } });
  const tipo = (nombre: string) => tipos.find((t) => t.nombre === nombre)!.id;
  const plan: Array<{
    camas: Array<{ tipo: 'SENCILLA' | 'DOBLE'; plazas: number }>;
    tipo: string;
  }> = [];
  // 5 sencillas (1 cama), 13 dobles con 2 camas sencillas, 2 triples (3 camas) = 20 hab., 37 camas
  for (let i = 0; i < 5; i++)
    plan.push({ tipo: 'Sencilla', camas: [{ tipo: 'SENCILLA', plazas: 1 }] });
  for (let i = 0; i < 13; i++) {
    plan.push({
      tipo: 'Doble',
      camas: [
        { tipo: 'SENCILLA', plazas: 1 },
        { tipo: 'SENCILLA', plazas: 1 },
      ],
    });
  }
  for (let i = 0; i < 2; i++) {
    plan.push({
      tipo: 'Triple',
      camas: [
        { tipo: 'SENCILLA', plazas: 1 },
        { tipo: 'SENCILLA', plazas: 1 },
        { tipo: 'SENCILLA', plazas: 1 },
      ],
    });
  }

  let creadas = 0;
  for (const [i, h] of plan.entries()) {
    const numero = String(i < 10 ? 101 + i : 201 + (i - 10));
    const existe = await prisma.habitacion.findFirst({ where: { numero, activa: true } });
    if (existe) continue;
    await prisma.habitacion.create({
      data: {
        numero,
        tipoHabitacionId: tipo(h.tipo),
        capacidad: h.camas.reduce((s, c) => s + c.plazas, 0),
        piso: i < 10 ? '1' : '2',
        descripcion: 'EJEMPLO de desarrollo: reemplazar por la distribución real del hotel',
        orden: i,
        camas: {
          create: h.camas.map((c, j) => ({
            identificador: String.fromCharCode(65 + j),
            tipo: c.tipo,
            plazas: c.plazas,
          })),
        },
      },
    });
    creadas += 1;
  }
  console.log(
    `  · Distribución de ejemplo: ${creadas} habitaciones nuevas (20 hab. / 37 camas en total)`,
  );
}
