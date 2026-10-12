# 0005. El sistema no calcula ni acepta precios

- Estado: aceptada
- Fecha: 2026-10-12

## Contexto
Las tarifas de la caracterización son material de consulta de 2026 y no están confirmadas como vigentes. No hay pagos en línea en el alcance.

## Decisión
- Ninguna tabla guarda precios de reserva y ningún endpoint los acepta (los esquemas estrictos rechazan campos desconocidos como `precio`).
- Las tarifas existen solo como **texto informativo** en `ajustes.tarifas`, que se publica únicamente si la administración lo marca como confirmado.

## Consecuencias
Cuando el hotel confirme tarifas y reglas, se agregará un módulo de precios en el servidor (dinero en `Decimal(14,2)`, cálculo y validación en el backend, con ADR propio) y, si se requiere, pagos con Wompi.
