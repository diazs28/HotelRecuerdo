# 0003. Fechas de calendario y noches

- Estado: aceptada (pendiente de validar horarios con el hotel)
- Fecha: 2026-10-12

## Decisión
- Entrada, salida y bloqueos son columnas `DATE` (sin hora), interpretadas en `America/Bogota`. "Hoy" se calcula en esa zona, no en la del servidor.
- Una reserva ocupa las noches `[entrada, salida)`: la fecha de salida no es noche. La salida de un huésped puede ser la entrada de otro el mismo día.
- La salida debe ser posterior a la entrada (`CHECK`); estancia máxima de 365 noches.
- Los bloqueos usan el mismo criterio: `fecha_fin` es el primer día en que la cama vuelve a estar disponible; sin `fecha_fin` el bloqueo es indefinido.
- Los horarios de *check-in* y *check-out* son información configurable; no cambian el cálculo de noches.

## Consecuencias
Si el hotel adopta otra política (por ejemplo, día de limpieza obligatorio entre reservas), se modela como un bloqueo o se ajusta el rango en `ocupaciones.service.ts`.
