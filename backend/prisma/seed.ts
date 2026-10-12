// Seed de Hotel El Recuerdo — idempotente: ejecutarlo varias veces no duplica datos.
//   npm run db:seed              permisos, roles, canales, tipos y datos por confirmar
//                                + administrador si SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD están definidas
//   npm run db:seed -- --demo    además, 20 habitaciones / 37 camas de EJEMPLO (solo fuera de producción)

import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  crearAdministrador,
  sembrarCatalogos,
  sembrarDistribucionDeEjemplo,
  sembrarPermisosYRoles,
} from './semilla.js';

async function main() {
  console.log('Seed de Hotel El Recuerdo:');
  await sembrarPermisosYRoles();
  await sembrarCatalogos();

  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    await crearAdministrador(
      env.SEED_ADMIN_NOMBRE ?? 'Administrador',
      env.SEED_ADMIN_EMAIL,
      env.SEED_ADMIN_PASSWORD,
    );
  } else {
    console.log('  · Administrador: omitido (usa "npm run crear-admin")');
  }

  if (process.argv.includes('--demo') || process.env.SEED_DEMO === 'true') {
    if (env.NODE_ENV === 'production') {
      console.log('  · Distribución de ejemplo: omitida en producción');
    } else {
      await sembrarDistribucionDeEjemplo();
    }
  }
}

main()
  .catch((err: unknown) => {
    console.error('El seed falló:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
