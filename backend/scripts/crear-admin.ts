// Crea el primer usuario administrador (y los datos base si faltan).
//
//   npm run crear-admin                                          (pregunta los datos)
//   docker compose run --rm migraciones npm run crear-admin      (en Docker)
//
// También acepta SEED_ADMIN_NOMBRE, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD como variables de
// entorno (útil en un pipeline). La contraseña nunca se muestra ni se registra.

import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { crearAdministrador, sembrarCatalogos, sembrarPermisosYRoles } from '../prisma/semilla.js';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

// Salida que se puede silenciar para no mostrar la contraseña mientras se escribe
let silenciar = false;
const salida = new Writable({
  write(chunk: Buffer, _enc, cb) {
    if (!silenciar) process.stdout.write(chunk);
    cb();
  },
});

function preguntar(texto: string, oculto = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: salida, terminal: true });
  return new Promise((resolve) => {
    process.stdout.write(texto);
    silenciar = oculto;
    rl.question('', (respuesta) => {
      silenciar = false;
      if (oculto) process.stdout.write('\n');
      rl.close();
      resolve(respuesta.trim());
    });
  });
}

async function main() {
  const nombre =
    env.SEED_ADMIN_NOMBRE ?? ((await preguntar('Nombre del administrador: ')) || 'Administrador');
  const emailCrudo = env.SEED_ADMIN_EMAIL ?? (await preguntar('Correo: '));
  const email = emailSchema.safeParse(emailCrudo);
  if (!email.success) throw new Error('Correo inválido');

  let password = env.SEED_ADMIN_PASSWORD;
  if (!password) {
    password = await preguntar('Contraseña (mínimo 12 caracteres): ', true);
    const confirmacion = await preguntar('Repite la contraseña: ', true);
    if (password !== confirmacion) throw new Error('Las contraseñas no coinciden');
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('La contraseña debe tener entre 12 y 128 caracteres');
  }

  await sembrarPermisosYRoles();
  await sembrarCatalogos();
  await crearAdministrador(nombre, email.data, password);
}

main()
  .catch((err: unknown) => {
    console.error('No se pudo crear el administrador:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
