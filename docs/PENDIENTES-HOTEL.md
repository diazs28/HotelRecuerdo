# Datos que debe confirmar la administración del hotel

Nada de esta lista se inventó. Lo que el sistema necesita para funcionar quedó como **configuración** editable desde el panel y **sin publicar**. Al confirmarlo, se carga en Panel → *Datos del hotel* y se marca como *confirmado* y luego *publicado*.

| # | Dato | Dónde se configura | Estado actual |
|---|---|---|---|
| 1 | Razón social, NIT y datos registrales | Datos del hotel → Responsable del tratamiento de datos | Vacío |
| 2 | Teléfono, WhatsApp, correo, dirección, redes y **autorización para publicarlos** | Datos del hotel → Contacto | Solo la ciudad (Popayán, Cauca), sin publicar |
| 3 | Distribución real de habitaciones, camas y capacidades (la caracterización registra 20 habitaciones y 37 camas) | Habitaciones y camas | En producción, vacío. En desarrollo, una distribución de **ejemplo** |
| 4 | Tipos de habitación que se ofrecen | Datos del hotel → Tipos de habitación | Cuatro tipos genéricos **sin publicar** |
| 5 | Tarifas vigentes y reglas de precio (la caracterización trae tarifas de consulta 2026 que **no** se publicaron) | Datos del hotel → Tarifas (solo texto informativo) | Vacío |
| 6 | Desayuno: si está incluido, horario (la caracterización menciona 7:00 a 9:30 a. m.) y condiciones | Datos del hotel → Desayuno | Precargado **sin confirmar** |
| 7 | Parqueadero: cupos, costo y horario | Datos del hotel → Parqueadero | Precargado **sin confirmar** |
| 8 | Wi-Fi: cobertura y condiciones | Datos del hotel → Wi-Fi | Precargado **sin confirmar** |
| 9 | Horarios de entrada (*check-in*) y salida (*check-out*) | Datos del hotel → Horarios | Vacío |
| 10 | Políticas de cancelación, anticipos, no presentación y cambios | Datos del hotel → Políticas | Vacío |
| 11 | Reglas para grupos, menores de edad, mascotas y huéspedes adicionales | Datos del hotel → Políticas | Vacío |
| 12 | Horario y descripción del restaurante y la pizzería | Datos del hotel → Restaurante y pizzería | Texto genérico basado en la historia |
| 13 | Cargos reales del personal y permisos por cargo | Personal y permisos | Roles iniciales *Administrador* y *Recepción* (supuesto) |
| 14 | Política de tratamiento de datos (texto oficial, versión, canal de atención de titulares) | Datos del hotel → Responsable del tratamiento de datos | Se muestra un aviso base, marcado como en revisión |
| 15 | Requisitos operativos y legales verificados (registro de huéspedes, Tarjeta de Registro Hotelero, RNT, facturación) | Por definir: el sistema guarda tipo y número de documento opcionales | Sin implementar |
| 16 | Redacción de la historia familiar | `frontend/src/config/marca.ts` | Redacción breve basada solo en hechos de la caracterización |
| 17 | Fotografías propias y logo | `frontend/public` | El sitio usa una ilustración, no fotos |

## Reglas de negocio supuestas que conviene validar

- La salida de una reserva libera la cama para una entrada ese mismo día.
- Para confirmar una reserva, las camas asignadas deben cubrir a todos los huéspedes (plazas ≥ personas).
- Una solicitud puede retener camas antes de confirmarse, si el personal se las asigna.
- El ingreso solo se registra entre la fecha de entrada y la noche anterior a la salida.
- Una salida anticipada recorta la reserva al día en que se finaliza.
- Recepción no ve el número de documento completo ni puede exportar o suprimir datos de huéspedes.
