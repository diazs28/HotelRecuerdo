# 0001. Arquitectura y stack: monolito web en la nube con Docker

- Estado: aceptada
- Fecha: 2026-10-12

## Contexto
El repositorio estaba vacío. El hotel necesita un sitio público y un panel interno para un equipo pequeño, con datos centralizados y ejecución en Docker. No hay requisito de funcionar sin internet ni de varios clientes nativos.

## Opciones
1. Monolito web: React + Vite (frontend) y Express 5 + Prisma + PostgreSQL (API), como PortalSalud.
2. Monorepo con NestJS y paquetes compartidos, como Karbon.
3. Aplicación de escritorio en red local.

## Decisión
Opción 1. Dos carpetas (`backend/`, `frontend/`), un `docker-compose.yml` con `db`, `migraciones`, `api` y `web`, y nginx sirviendo el frontend y reenviando `/api` (un solo origen).

## Consecuencias
- Menos piezas que mantener; el equipo ya conoce el stack.
- Si el hotel crece a varias sedes o apps nativas, se puede extraer un paquete de tipos compartidos o migrar a monorepo.
