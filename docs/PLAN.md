# Plan de entrega — Hotel El Recuerdo

Una fase = una rama = un PR hacia `develop`. Esta primera entrega se construyó en `feature/sistema-reservas` (commits pequeños por área).

| Fase | Contenido | Estado |
|---|---|---|
| 0. Base | Repositorio, tooling, Docker Compose (db, migraciones, api, web), `.env.example` | ✅ |
| 1. Modelo y reglas | Esquema Prisma, CHECK, exclusión de ocupaciones, auditoría inmutable, seed idempotente | ✅ |
| 2. Autenticación y roles | JWT, argon2id, permisos configurables por rol, límite de intentos | ✅ |
| 3. Habitaciones, camas y bloqueos | CRUD, retiro sin borrar historial, bloqueos y mantenimiento con motivo y periodo | ✅ |
| 4. Reservas | Crear, editar, cambiar estado, asignar camas, idempotencia, búsqueda, calendario | ✅ |
| 5. Disponibilidad y tablero | Mapa por cama y noche, camas libres, indicadores con fórmula | ✅ |
| 6. Huéspedes y privacidad | Datos según permisos, exportar y suprimir | ✅ |
| 7. Sitio público | Inicio, solicitud de disponibilidad, privacidad, datos publicables | ✅ |
| 8. Verificación | 74 pruebas de backend (incluye concurrencia y casos límite) + 3 de frontend, revisión de seguridad y de backend | ✅ |
| 9. Próximas | Ver abajo | Pendiente |

## Próximas fases sugeridas

1. **Datos reales del hotel.** Cargar la distribución, los contactos y las políticas confirmadas (ver [PENDIENTES-HOTEL.md](PENDIENTES-HOTEL.md)).
2. **Notificaciones.** Avisar al personal por correo o WhatsApp cuando llegue una solicitud, y confirmar al huésped.
3. **Tarifas y pagos.** Cálculo de precios en el servidor con Decimal y anticipos con Wompi (requiere ADR).
4. **Operación.** Respaldos automáticos, rol de base de datos con permisos mínimos, despliegue en un servidor con dominio y HTTPS.
5. **Registro hotelero.** Datos de acompañantes y reportes que exija la normativa, una vez verificada por la administración.
6. **Pruebas end-to-end** del panel con Playwright en CI.
