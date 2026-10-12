// Crea o actualiza el rol de PostgreSQL con el que se conecta la API (mínimo privilegio).
//
// Se ejecuta en el paso de migraciones, conectado con el rol DUEÑO (MIGRATION_DATABASE_URL). Toma
// el usuario y la contraseña del rol de la API de DATABASE_URL. El rol de la API:
//   - solo puede leer y escribir datos (SELECT, INSERT, UPDATE, DELETE), nunca cambiar tablas;
//   - no puede modificar ni borrar la auditoría (además del trigger que lo impide);
//   - no tiene acceso a la tabla interna de migraciones.
// Idempotente: se puede ejecutar en cada despliegue.

import pg from 'pg';

const urlDueno = process.env.MIGRATION_DATABASE_URL;
const urlApp = process.env.DATABASE_URL;
if (!urlDueno || !urlApp) {
  console.error('Faltan MIGRATION_DATABASE_URL y/o DATABASE_URL');
  process.exit(1);
}

const app = new URL(urlApp);
const dueno = new URL(urlDueno);
const usuario = decodeURIComponent(app.username);
const clave = decodeURIComponent(app.password);
const baseDatos = app.pathname.slice(1);

// Se validan antes de usarlos en sentencias DDL (que no admiten parámetros)
if (!/^[a-z_][a-z0-9_]{2,40}$/.test(usuario)) {
  console.error('El usuario de DATABASE_URL debe tener solo minúsculas, números y guion bajo');
  process.exit(1);
}
if (!/^[A-Za-z0-9]{16,128}$/.test(clave)) {
  console.error('La contraseña del rol de la API debe tener 16 a 128 letras y números');
  process.exit(1);
}
if (usuario === decodeURIComponent(dueno.username)) {
  console.log(
    '  · Rol de la API: usa el mismo rol de las migraciones (sin separar), no se modifica',
  );
  process.exit(0);
}

const cliente = new pg.Client({ connectionString: urlDueno });
await cliente.connect();
try {
  const existe = await cliente.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [usuario]);
  const sentencia = existe.rowCount
    ? `ALTER ROLE "${usuario}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${clave}'`
    : `CREATE ROLE "${usuario}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${clave}'`;
  await cliente.query(sentencia);
  await cliente.query(`GRANT CONNECT ON DATABASE "${baseDatos}" TO "${usuario}"`);
  await cliente.query(`GRANT USAGE ON SCHEMA public TO "${usuario}"`);
  await cliente.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${usuario}"`,
  );
  await cliente.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${usuario}"`);
  await cliente.query(`REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM "${usuario}"`);
  await cliente.query(`REVOKE ALL ON _prisma_migrations FROM "${usuario}"`);
  // Tablas y secuencias que creen migraciones futuras
  await cliente.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${usuario}"`,
  );
  await cliente.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${usuario}"`,
  );
  console.log('  · Rol de la API con permisos mínimos: listo');
} finally {
  await cliente.end();
}
