# Hotel El Recuerdo — guía para agentes

Proyecto de cliente: nombres de código, comentarios, commits y documentación en **español**.

## Comandos
- Backend (`backend/`): `npm run dev`, `npm run check` (format, lint, tipos, pruebas, build), `npm test` (necesita `TEST_DATABASE_URL` con "test" en el nombre), `npm run db:seed -- --demo`, `npm run crear-admin`.
- Frontend (`frontend/`): `npm run dev` (Vite en 5173, reenvía `/api` a 4000), `npm run check`.
- Docker: `docker compose up -d db` (solo PostgreSQL en 127.0.0.1:5436) o `docker compose up -d --build` (todo en http://localhost:8080).

## Reglas que no se rompen
- Toda ocupación de camas pasa por `backend/src/services/ocupaciones.service.ts`; la restricción `ocupaciones_cama_sin_cruce` es la garantía contra la sobreventa (docs/adr/0002).
- El flujo de estados vive solo en `backend/src/domain/estadosReserva.ts`.
- Nada de precios en el sistema (docs/adr/0005). No inventar datos del hotel: van en Configuración sin publicar.
- Migraciones nuevas para cada cambio de esquema; nunca editar una aplicada.
- Rutas delgadas; reglas en services; funciones puras en domain; auditoría dentro de la transacción.
- Datos personales: nunca en logs ni en la auditoría.
