# syntax=docker/dockerfile:1.7
# ============================================================
# Hotel El Recuerdo — API (multi-stage, usuario no root)
#
#   docker build --target runtime     -t hotel-api .            # imagen de la API
#   docker build --target migraciones -t hotel-migraciones .    # paso de release
#
# Las migraciones NO se ejecutan al arrancar la API: corren en un paso aparte
# (servicio "migraciones" de docker-compose.yml) y la API espera a que terminen bien.
# Ningún secreto se copia a la imagen: todo llega por variables de entorno al ejecutar.
# ============================================================
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

# Dependencias completas (compilar, generar Prisma, migrar)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Compilación: cliente de Prisma + TypeScript -> dist/
FROM deps AS build
COPY tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
# prisma generate no se conecta a la base, pero prisma.config.ts exige una URL
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && npm run build

# Solo dependencias de producción
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Imagen de la API ----------
FROM base AS runtime
ENV NODE_ENV=production PORT=4000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000
# /api/health/db comprueba también la base de datos
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health/db',{signal:AbortSignal.timeout(4000)}).then(r=>{process.exitCode=r.ok?0:1}).catch(()=>{process.exitCode=1})"
# node como PID 1 recibe SIGTERM: server.ts cierra conexiones y Prisma ordenadamente
CMD ["node", "dist/server.js"]

# ---------- Paso de release: migraciones, datos base y primer administrador ----------
FROM deps AS migraciones
ENV NODE_ENV=production
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
USER node
# Aplica las migraciones pendientes (rol dueño), crea o actualiza el rol de mínimo privilegio de la
# API y carga los datos base (idempotente: permisos, roles, canales).
#   docker compose run --rm migraciones npm run crear-admin     (primer administrador)
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/rol-aplicacion.ts && npx tsx prisma/seed.ts"]
