# Requisitos

## Fuente
Pedido del cliente con el resumen de la caracterización del hotel. **Hechos:** empresa familiar en Popayán, Cauca; trayectoria iniciada con una pizzería en 1979; hoy combina alojamiento con restaurante y pizzería; registro de 20 habitaciones y 37 camas; público de viajeros corporativos, salud, académico, turistas y grupos; gestión mayoritariamente manual. **Por confirmar:** desayuno (7:00 a 9:30 a. m.), parqueadero, Wi-Fi y tarifas 2026 (solo consulta). Las recomendaciones del informe no se trataron como políticas aprobadas.

## Actores
| Actor | Usa |
|---|---|
| Visitante | Sitio público, consulta orientativa de disponibilidad, solicitud |
| Recepción | Tablero, reservas, camas, bloqueos, huéspedes (sin documento completo) |
| Administración | Todo, incluida la configuración, el personal, los permisos y la auditoría |

## Historias principales y criterios de aceptación
- Como **visitante**, quiero enviar mis fechas y personas para que el hotel me responda. *Se crea una SOLICITUD, se muestra que no está confirmada y no se duplica si reenvío.*
- Como **recepción**, quiero convertir una solicitud en reserva confirmada. *Asigno camas libres; confirmar exige plazas suficientes; queda en el historial con fecha y responsable.*
- Como **recepción**, quiero ver qué camas están disponibles, retenidas, ocupadas, bloqueadas o en mantenimiento por noche. *Mapa de ocupación calculado en el servidor.*
- Como **recepción**, quiero bloquear una cama o habitación por mantenimiento con motivo y periodo. *No se puede asignar en ese periodo y no se puede bloquear sobre una reserva.*
- Como **administración**, quiero configurar las habitaciones y camas sin tocar código. *CRUD con retiro sin borrar historial; resumen de habitaciones, camas y plazas.*
- Como **administración**, quiero publicar contacto, servicios, políticas y tarifas solo cuando estén confirmados. *Doble marca confirmado y publicado; el sitio solo muestra lo publicado.*
- Como **titular de datos**, quiero conocer y suprimir mis datos. *Exportar y anonimizar desde el panel con permiso específico.*

## Flujo crítico
Solicitud web → aparece en *Por responder* → recepción asigna camas (la base impide cruces) → confirma → registra la llegada en la fecha → registra la salida (salida anticipada libera noches) → historial completo en la auditoría.

## No funcionales
Español de Colombia, zona `America/Bogota`, responsive (375, 768 y 1280 px), accesibilidad AA, `prefers-reduced-motion`, seguridad según el checklist de 20 puntos, Docker reproducible, pruebas de concurrencia.

## Fuera de alcance (esta entrega)
Pagos y cálculo de precios, notificaciones automáticas, facturación electrónica, integración con OTAs (Booking, Airbnb), registro hotelero oficial, restaurante (pedidos o menú en línea), fotografías.
