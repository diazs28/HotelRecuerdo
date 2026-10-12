#!/bin/sh
# Crea la base de pruebas (npm test la vacía en cada ejecución). Solo corre al iniciar un volumen vacío.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
SELECT 'CREATE DATABASE ${POSTGRES_DB}_test OWNER "${POSTGRES_USER}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}_test')\gexec
SQL
