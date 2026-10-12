# Hotel El Recuerdo — sitio web y sistema de reservas

## Descripción

Aplicación web para **Hotel El Recuerdo** (Popayán, Cauca): hotel familiar con restaurante y pizzería, cuya historia empezó con una pizzería en 1979.

Incluye:

1. **Sitio público** (`/`): historia, alojamiento, restaurante y pizzería, servicios y contacto, más un formulario para **solicitar disponibilidad**. Una solicitud **no** es una reserva confirmada: el personal la revisa y responde.
2. **Panel del personal** (`/panel`): tablero del día, reservas (lista y calendario), ocupación por cama, habitaciones y camas, bloqueos y mantenimiento, huéspedes, datos del hotel, personal y permisos, y auditoría.
3. **Ejecución con Docker**: PostgreSQL, migraciones, API y sitio web con un solo comando.

La regla central es que **ninguna cama puede quedar asignada a dos reservas (o a una reserva y un bloqueo) en noches que se cruzan**, ni siquiera con solicitudes simultáneas. Lo garantiza la base de datos (ver [ADR 0002](docs/adr/0002-exclusion-de-ocupaciones-en-postgresql.md)).

## Supuestos

Decisiones tomadas para avanzar. Están en configuración o en un solo archivo y se validan con la administración del hotel:

- **Fuente de datos.** Se usó el resumen de la caracterización incluido en el pedido. El documento adjunto no estaba disponible en el equipo, así que conviene contrastarlo.
- **Fechas.** Una reserva ocupa las noches `[entrada, salida)` en la zona horaria `America/Bogota`. La salida de un huésped puede ser la entrada de otro el mismo día ([ADR 0003](docs/adr/0003-fechas-y-noches.md)).
- **Estados.** Solicitud → Pendiente de confirmación → Confirmada → En alojamiento → Finalizada, y Cancelada desde los tres primeros ([ADR 0004](docs/adr/0004-flujo-de-estados.md)).
- **Confirmación.** Para confirmar una reserva, las camas asignadas deben sumar al menos tantas plazas como huéspedes.
- **Ingreso y salida.** El ingreso (*check-in*) solo se registra entre la fecha de entrada y la noche anterior a la salida. Si el huésped se va antes, finalizar la reserva libera las noches que no usó.
- **Roles iniciales.** *Administrador* tiene todo. *Recepción* gestiona reservas, camas y bloqueos y ve el contacto de los huéspedes, pero no el documento completo ni la configuración. Los permisos se cambian desde el panel.
- **Precios.** El sistema **no calcula precios** ([ADR 0005](docs/adr/0005-sin-precios-en-el-sistema.md)). Las tarifas son texto informativo que solo se publica si la administración lo confirma.
- **Distribución de ejemplo.** 20 habitaciones y 37 camas: 5 sencillas, 13 dobles con dos camas y 2 triples. Solo se carga en desarrollo con `npm run db:seed -- --demo`. **No es la distribución real.**
- **Tipos de habitación.** Los tipos iniciales (Sencilla, Doble, Triple, Múltiple) se crean **sin publicar**.

## Pendiente del cliente

La lista completa está en [docs/PENDIENTES-HOTEL.md](docs/PENDIENTES-HOTEL.md). Incluye NIT y datos registrales, contacto y autorización para publicarlo, distribución real de habitaciones y camas, tarifas, horarios, desayuno, parqueadero, Wi-Fi, políticas, roles del personal y política de tratamiento de datos.

## Stack

| Parte | Tecnología |
|---|---|
| Frontend | React 19, Vite 7, TypeScript estricto, Tailwind CSS 4, TanStack Query, React Router 7 |
| Backend | Node.js 22, Express 5, TypeScript, Zod 4, Prisma 7, argon2, pino |
| Base de datos | PostgreSQL 16 (con `btree_gist` para la restricción de exclusión) |
| Infraestructura | Docker Compose, nginx sin privilegios (sitio + proxy `/api`) y Caddy (HTTPS en producción) |

## Requisitos

- Docker Desktop (o Docker Engine con Compose v2).
- Para desarrollar sin contenedores de aplicación: Node.js 22 o superior y npm.

## Instalación y puesta en marcha con Docker

```bash
# 1. Variables: copia el ejemplo y completa POSTGRES_PASSWORD, APP_DB_PASSWORD y JWT_SECRET
cp .env.example .env
#    Genera cada secreto con:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Construir y arrancar todo (db → migraciones → api → web)
docker compose up -d --build

# 3. Crear el primer usuario administrador (pregunta nombre, correo y contraseña)
docker compose run --rm migraciones npm run crear-admin

# 4. Abrir el sitio:  http://localhost:8080      Panel:  http://localhost:8080/panel
```

### Operación diaria

| Acción | Comando |
|---|---|
| Ver el estado | `docker compose ps` |
| Ver los registros | `docker compose logs -f api` (o `web`, `db`, `migraciones`) |
| Detener | `docker compose stop` |
| Detener y quitar contenedores (los datos se conservan en el volumen) | `docker compose down` |
| Aplicar migraciones nuevas | `docker compose run --rm migraciones` |
| Actualizar a una versión nueva | `git pull && docker compose up -d --build` |
| Copia de seguridad | `docker compose exec -T db pg_dump -U <usuario> hotel_el_recuerdo > respaldo.sql` |

Las migraciones **no** se aplican al arrancar la API. Las aplica el servicio `migraciones`, que termina, y la API espera a que lo haga bien. Ese mismo paso carga los datos base de forma idempotente: permisos, roles, canales y tipos.

## Variables de entorno

Raíz (`.env`, usada por Docker Compose; plantilla en [`.env.example`](.env.example)):

| Variable | Para qué |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Rol dueño de la base: solo lo usan las migraciones (contraseña solo con letras y números) |
| `APP_DB_USER`, `APP_DB_PASSWORD` | Rol con el que se conecta la API: solo lee y escribe datos, no puede cambiar tablas ni la auditoría. Lo crea el paso de migraciones (contraseña de 16 o más letras y números) |
| `POSTGRES_PORT` | Puerto publicado **solo en 127.0.0.1** para desarrollar (por defecto 5436) |
| `JWT_SECRET` | Secreto de las sesiones del personal (mínimo 32 caracteres) |
| `JWT_TTL_MIN` | Duración de la sesión en minutos (por defecto 120, máximo 720) |
| `TRUST_PROXY` | Proxies delante de la API (1: nginx; en producción, 2: Caddy y nginx) |
| `CORS_ORIGINS` | Orígenes permitidos del navegador |
| `WEB_PORT` | Puerto del sitio (por defecto 8080) |
| `SITIO_URL` | URL pública para el enlace canónico y la imagen de redes (en producción, `https://$DOMINIO`) |
| `DOMINIO` | Solo en producción: dominio para HTTPS con Caddy |

Backend en desarrollo (`backend/.env`; plantilla en [`backend/.env.example`](backend/.env.example)): `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `TRUST_PROXY`, límites de intentos y, opcionalmente, `SEED_ADMIN_*`.

La API **no arranca** si falta una variable obligatoria o si en producción falta `TRUST_PROXY`. El error nombra la variable, nunca su valor.

## Desarrollo local (recarga en caliente)

```bash
docker compose up -d db                 # solo PostgreSQL (crea también la base de pruebas)
cd backend  && cp .env.example .env     # completa DATABASE_URL, TEST_DATABASE_URL y JWT_SECRET
npm install && npx prisma migrate dev && npm run db:seed -- --demo && npm run crear-admin
npm run dev                             # API en http://localhost:4000 (docs en /api/docs)
cd ../frontend && npm install && npm run dev   # http://localhost:5173 (Vite reenvía /api)
```

## Scripts

| Carpeta | Script | Qué hace |
|---|---|---|
| backend | `npm run check` | Formato, lint, tipos, pruebas (unitarias + integración) y build |
| backend | `npm test` / `npm run test:unit` | Pruebas (las de integración necesitan `TEST_DATABASE_URL`) |
| backend | `npm run db:seed [-- --demo]` | Datos base (y distribución de ejemplo) |
| backend | `npm run crear-admin` | Primer administrador |
| frontend | `npm run check` | Formato, lint, tipos, pruebas y build |

## Estructura

```
hotel-el-recuerdo/
├─ docker-compose.yml        db, migraciones, api, web
├─ docker-compose.prod.yml   ajustes de producción (+ Caddy con HTTPS)
├─ deploy/Caddyfile
├─ docker/postgres/          script que crea la base de pruebas
├─ backend/
│  ├─ prisma/                schema.prisma, migraciones (CHECK, exclusión, auditoría inmutable), seed
│  ├─ src/
│  │  ├─ config/env.ts       variables validadas con Zod
│  │  ├─ domain/             reglas puras: fechas, estados, ocupación, permisos, privacidad
│  │  ├─ services/           reglas de negocio y transacciones (ocupaciones.service = único que toca camas)
│  │  ├─ routes/             rutas delgadas: validar, autorizar, llamar
│  │  ├─ schemas/            esquemas Zod (también generan el OpenAPI)
│  │  └─ middlewares/        auth, permisos, errores, rate limit
│  └─ test/                  unitarias e integración (incluye concurrencia)
├─ frontend/
│  ├─ nginx.conf             sitio + proxy /api + cabeceras de seguridad
│  └─ src/
│     ├─ config/marca.ts     textos de marca (único lugar)
│     ├─ api/                cliente HTTP, sesión (sessionStorage), endpoints, tipos
│     ├─ pages/publico/      inicio, solicitud, privacidad
│     └─ pages/admin/        tablero, reservas, ocupación, habitaciones, huéspedes, configuración…
└─ docs/                     requisitos, arquitectura, API, plan, ADR, pendientes del hotel, privacidad
```

## Personalización

| Qué | Dónde |
|---|---|
| Teléfono, WhatsApp, correo, dirección, redes, horarios, servicios, políticas, tarifas, responsable de datos | Panel → **Datos del hotel** (cada bloque se marca *confirmado* y luego *publicado*) |
| Habitaciones, camas y su distribución | Panel → **Habitaciones y camas** |
| Tipos de habitación y canales de origen | Panel → **Datos del hotel** (al final) |
| Usuarios y permisos por rol | Panel → **Personal y permisos** |
| Textos de historia y marca | `frontend/src/config/marca.ts` |
| Flujo de estados de la reserva | `backend/src/domain/estadosReserva.ts` (y sus pruebas) |
| Colores y tipografía | `frontend/src/index.css` (`@theme`) |

## Despliegue

Producción en un servidor con Docker (por ejemplo, un Droplet):

```bash
# .env con valores de producción + DOMINIO=reservas.ejemplo.com (DNS apuntando al servidor)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migraciones npm run crear-admin
```

| | Desarrollo (`docker-compose.yml`) | Producción (`+ docker-compose.prod.yml`) |
|---|---|---|
| PostgreSQL | Puerto publicado en `127.0.0.1` | Sin puerto publicado |
| Sitio | `http://localhost:8080` | HTTPS automático con Caddy en 80/443 |
| CORS | `http://localhost:8080` | `https://$DOMINIO` |
| Reinicio | `unless-stopped` | `always` |
| Datos de ejemplo | `npm run db:seed -- --demo` (opcional) | Nunca (el seed los omite en producción) |
| Base de pruebas | Se crea al iniciar el volumen | No se crea |
| IP real del visitante | `TRUST_PROXY=1` (nginx) | `TRUST_PROXY=2` (Caddy y nginx) |

Recomendado antes de salir a producción: respaldo diario automático de la base (por ejemplo, `pg_dump` programado y copiado fuera del servidor) y monitoreo de `GET /api/health/db`.

## Seguridad

- Sesión del personal con JWT HS256 en `sessionStorage` (nunca `localStorage`), invalidable al cerrar sesión, cambiar contraseña, desactivar a la persona o cambiar su rol.
- Contraseñas con argon2id. El login responde igual y en el mismo tiempo si el correo no existe. Límite de intentos fallidos por IP, por IP y correo, y por cuenta desde cualquier IP, guardado en PostgreSQL. Una cabecera `X-Forwarded-For` falsificada no cambia la IP que se cuenta.
- La API se conecta con un rol de PostgreSQL de **mínimo privilegio** (sin DDL, sin acceso a la tabla de migraciones, sin poder editar la auditoría). El rol dueño solo lo usan las migraciones.
- Autorización en **cada** ruta del panel por permisos `recurso:accion`, configurables por rol.
- Validación estricta con Zod en el servidor: campos desconocidos se rechazan, incluido cualquier precio enviado desde el navegador.
- Formulario público con límite por IP, campo trampa para robots, autorización de datos obligatoria e `Idempotency-Key` para no duplicar solicitudes.
- Errores con formato único `{ error: { code, message, details? } }`, sin mensajes internos. Los logs no guardan cuerpos, búsquedas ni datos personales.
- Datos personales según permisos (documento y contacto enmascarados). Exportación y supresión del titular según la Ley 1581 (ver [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md)). **No se afirma cumplimiento legal certificado.**
- Auditoría inmutable (un *trigger* impide editarla o borrarla).
- Contenedores sin root, sin secretos en las imágenes, CSP y cabeceras de seguridad en nginx (también para `/assets`) y helmet en la API. El panel lleva `X-Robots-Tag: noindex` y `robots.txt` lo excluye.
- Los errores inesperados se registran sin su mensaje (Prisma puede incluir datos de la consulta).
- `npm audit` (0 vulnerabilidades) y gitleaks (sin secretos en el historial) en CI. La única excepción de gitleaks son las contraseñas ficticias de `backend/test/` (`.gitleaks.toml`).

Documentación de la API: [docs/API.md](docs/API.md) y Swagger en `/api/docs` (fuera de producción).
