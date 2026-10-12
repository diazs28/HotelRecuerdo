# 0002. La base de datos impide la sobreventa de camas

- Estado: aceptada
- Fecha: 2026-10-12

## Contexto
Dos personas del personal (o el personal y un bloqueo de mantenimiento) pueden intentar tomar la misma cama para noches que se cruzan al mismo tiempo. Una verificación "consultar y luego insertar" en la aplicación tiene una ventana de carrera.

## Opciones
1. Verificar en el servicio y bloquear con `SELECT … FOR UPDATE` sobre las camas.
2. Nivel de aislamiento SERIALIZABLE con reintentos.
3. Restricción de exclusión de PostgreSQL sobre rangos de fechas (`btree_gist`).

## Decisión
Opción 3. Reservas y bloqueos se representan como filas de `ocupaciones_cama` (una por cama) con el rango `[fecha_inicio, fecha_fin)`, y la tabla tiene:

```sql
EXCLUDE USING gist (cama_id WITH =, daterange(fecha_inicio, fecha_fin, '[)') WITH &&) WHERE (activa)
```

Un único servicio (`ocupaciones.service.ts`) crea, mueve y libera ocupaciones dentro de transacciones. La violación (SQLSTATE 23P01) se traduce a `409 CAMA_NO_DISPONIBLE` con el detalle de la ocupación existente. Las liberaciones no borran filas: las marcan `activa = false` (historial).

## Consecuencias
- La garantía no depende del código de la aplicación ni del número de instancias de la API.
- Un bloqueo no puede crearse sobre una cama reservada, ni una reserva sobre una cama bloqueada: el personal debe reasignar primero.
- Una cama nueva en una habitación con un bloqueo de habitación completa recibe ese bloqueo al crearse.
- Probado con 10 solicitudes simultáneas (`test/integration/concurrencia.test.ts`).
