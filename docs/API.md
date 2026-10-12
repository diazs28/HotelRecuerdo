# API

Base: `/api`. Formato de error: `{ "error": { "code": "CODIGO", "message": "Texto para la persona", "details": [...] } }`.
Fechas de calendario: `AAAA-MM-DD` (zona `America/Bogota`). La especificación OpenAPI 3.1 se genera desde los mismos esquemas Zod que validan las rutas: `GET /api/docs/openapi.json` y Swagger UI en `/api/docs` (fuera de producción).

## Públicas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health`, `/health/db` | Salud del proceso y de la base |
| GET | `/publico/hotel` | Solo los datos **confirmados y publicados**, más los tipos de habitación publicados |
| GET | `/publico/disponibilidad?fechaEntrada&fechaSalida&cantidadHuespedes` | Disponibilidad orientativa por tipo (sin detalle de ocupación) |
| POST | `/publico/solicitudes` | Crea una **SOLICITUD** (sin camas). Requiere `Idempotency-Key`. Límite por IP |

## Sesión

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Correo y contraseña → token. Límite de intentos fallidos |
| POST | `/auth/logout` | Invalida todos los tokens del usuario |
| GET | `/auth/me` | Perfil y permisos |
| POST | `/auth/password` | Cambiar la propia contraseña |

## Panel (`/admin`, requieren sesión y permiso)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/admin/tablero` | `tablero:ver` |
| GET, POST | `/admin/reservas` | `reservas:ver` / `reservas:gestionar` (`Idempotency-Key` opcional) |
| GET, PATCH | `/admin/reservas/:id` | `reservas:ver` / `reservas:gestionar` |
| POST | `/admin/reservas/:id/estado` | `reservas:gestionar` (cancelar: `reservas:cancelar`) |
| POST | `/admin/reservas/:id/camas` | `reservas:gestionar` |
| DELETE | `/admin/reservas/:id/camas/:camaId` | `reservas:gestionar` |
| GET, POST | `/admin/habitaciones` | `habitaciones:ver` / `habitaciones:gestionar` |
| GET, PATCH | `/admin/habitaciones/:id` | `habitaciones:ver` / `habitaciones:gestionar` |
| POST, PATCH | `/admin/habitaciones/:id/camas[/:camaId]` | `habitaciones:gestionar` |
| GET, POST | `/admin/bloqueos` | `habitaciones:ver` / `bloqueos:gestionar` |
| POST | `/admin/bloqueos/:id/liberar` | `bloqueos:gestionar` |
| GET | `/admin/disponibilidad?desde&hasta` | `habitaciones:ver` o `reservas:ver` (máximo 62 días) |
| GET | `/admin/disponibilidad/camas-libres?fechaEntrada&fechaSalida` | `habitaciones:ver` o `reservas:ver` |
| GET | `/admin/huespedes[/:id]` | `huespedes:ver` o `reservas:ver` (datos según permisos) |
| PATCH | `/admin/huespedes/:id` | `reservas:gestionar` |
| GET | `/admin/huespedes/:id/exportar` | `huespedes:gestionar_datos` |
| POST | `/admin/huespedes/:id/anonimizar` | `huespedes:gestionar_datos` |
| GET, PUT | `/admin/configuracion/ajustes[/:clave]` | `configuracion:gestionar` |
| GET, POST, PATCH | `/admin/configuracion/tipos-habitacion`, `/canales` | lectura: sesión; escritura: `configuracion:gestionar` |
| GET, POST, PATCH | `/admin/usuarios` | `usuarios:gestionar` |
| GET | `/admin/usuarios/personal` | `reservas:ver` |
| GET, PUT | `/admin/roles`, `/admin/roles/:id/permisos` | `usuarios:gestionar` |
| GET | `/admin/auditoria` | `auditoria:ver` |

## Códigos de error de negocio

| Código | HTTP | Cuándo |
|---|---|---|
| `CAMA_NO_DISPONIBLE` | 409 | Una cama ya está ocupada o bloqueada en esas noches (el detalle trae cama, habitación y código de reserva) |
| `TRANSICION_INVALIDA`, `ESTADO_REPETIDO` | 409 | Cambio de estado no permitido o repetido |
| `CAPACIDAD_INSUFICIENTE` | 409 | Confirmar o quitar camas dejaría plazas < huéspedes |
| `FECHA_NO_PERMITE_INGRESO` | 409 | Registrar la llegada fuera de las fechas de la reserva |
| `CAMPO_NO_EDITABLE` | 409 | Editar un dato que ya no se puede cambiar en ese estado |
| `IDEMPOTENCY_KEY_REUSED` | 422 | La misma clave con datos distintos |
| `TIENE_RESERVAS` | 409 | Retirar una cama o habitación con reservas vigentes |
| `VALIDATION_ERROR` | 400 | Datos inválidos (con `details` por campo) |
| `RATE_LIMITED` | 429 | Demasiados intentos |
