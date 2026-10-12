# 0004. Flujo de estados de la reserva

- Estado: aceptada (flujo inicial sugerido por el pedido)
- Fecha: 2026-10-12

## Decisión
Estados fijos con transiciones definidas en un solo lugar (`backend/src/domain/estadosReserva.ts`):

| Desde | Hacia |
|---|---|
| Solicitud | Pendiente de confirmación, Confirmada, Cancelada |
| Pendiente de confirmación | Confirmada, Cancelada |
| Confirmada | En alojamiento, Cancelada |
| En alojamiento | Finalizada |
| Finalizada, Cancelada | — (finales) |

Condiciones: confirmar exige plazas asignadas ≥ huéspedes; registrar la llegada solo entre la entrada y la noche anterior a la salida; cancelar exige motivo y libera las camas; finalizar antes de la salida recorta la reserva a hoy.

Cada cambio bloquea la fila de la reserva, valida la transición, actualiza con `where estado = actual` y registra la auditoría en la misma transacción. Transición inválida o repetida → 409.

## Por qué no estados configurables en la base
El pedido pide estados "configurables", pero las reglas de inventario dependen de cada estado (cuáles ocupan camas, cuáles se pueden editar). Estados libres en la base harían posible configurar un flujo que rompa esas garantías. Se eligió configurar el flujo en código (un archivo, con pruebas) y las **etiquetas** en la interfaz. Si el hotel necesita estados adicionales (por ejemplo, "No se presentó"), se agregan ahí con su migración.
