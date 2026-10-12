// Ejecuta las pruebas con el runner nativo de Node (node:test) + tsx.
//   node scripts/test.mjs           unitarias + integración
//   node scripts/test.mjs --unit    solo unitarias (no necesitan base de datos)
// Las de integración usan TEST_DATABASE_URL (se vacía en cada archivo de pruebas) y aplican las
// migraciones con `prisma migrate deploy` antes de empezar (TEST_SKIP_MIGRATE=1 lo omite).
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const soloUnitarias = process.argv.includes('--unit');

function buscarPruebas(dir) {
  let archivos = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos = archivos.concat(buscarPruebas(ruta));
    else if (nombre.endsWith('.test.ts')) archivos.push(ruta);
  }
  return archivos.sort();
}

const unitarias = buscarPruebas('test/unit');
const integracion = soloUnitarias ? [] : buscarPruebas('test/integration');
const testDb = process.env.TEST_DATABASE_URL;

if (integracion.length > 0) {
  if (!testDb) {
    console.error('Define TEST_DATABASE_URL (o ejecuta "npm run test:unit").');
    process.exit(1);
  }
  if (testDb === process.env.DATABASE_URL) {
    console.error(
      'TEST_DATABASE_URL no puede ser igual a DATABASE_URL: las pruebas borran los datos.',
    );
    process.exit(1);
  }
  const nombreBd = new URL(testDb).pathname.slice(1);
  if (!nombreBd.toLowerCase().includes('test')) {
    console.error(
      `Por seguridad, el nombre de la base de pruebas debe contener "test" (actual: "${nombreBd}").`,
    );
    process.exit(1);
  }
}

// Entorno aislado: secreto aleatorio y límites conocidos
const env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: testDb ?? 'postgresql://sin-base-de-datos@127.0.0.1:1/test',
  // Prisma CLI usa MIGRATION_DATABASE_URL si existe: se fuerza a la base de pruebas
  MIGRATION_DATABASE_URL: testDb ?? 'postgresql://sin-base-de-datos@127.0.0.1:1/test',
  TRUST_PROXY: '0',
  CORS_ORIGINS: 'http://localhost:5173',
  JWT_SECRET: randomBytes(48).toString('base64url'),
  AUTH_RATE_LIMIT_MAX: '5',
  RATE_LIMIT_MAX: '100000',
  SOLICITUDES_RATE_LIMIT_MAX: '8',
  DISPONIBILIDAD_RATE_LIMIT_MAX: '1000',
  API_DOCS_ENABLED: 'true',
  SEED_ADMIN_EMAIL: '',
  SEED_ADMIN_PASSWORD: '',
};

if (integracion.length > 0 && process.env.TEST_SKIP_MIGRATE !== '1') {
  const r = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    {
      env,
      stdio: 'inherit',
    },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const r = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-concurrency=1', ...unitarias, ...integracion],
  { env, stdio: 'inherit' },
);
process.exit(r.status ?? 1);
