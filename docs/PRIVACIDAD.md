# Datos personales (Ley 1581 de 2012)

> Este documento describe las **medidas técnicas** del sistema. No es una política de tratamiento de datos ni certifica cumplimiento legal: la política oficial la debe emitir y validar el hotel como responsable del tratamiento.

| Principio | Cómo lo aplica el sistema |
|---|---|
| Finalidad y minimización | Del huésped solo se guardan nombres, apellidos, teléfono y/o correo, y documento opcional. No se piden datos de salud, pagos ni fecha de nacimiento |
| Autorización | El formulario público exige marcar la autorización. Se guarda la fecha y la versión del texto aceptado (`consentimiento_en`, `version_politica`) |
| Acceso restringido | Solo el personal autenticado. El contacto y el documento se enmascaran según permisos (`huespedes:ver`, `huespedes:ver_documento`) |
| Derecho de acceso | Panel → Huéspedes → *Exportar sus datos* (JSON con todo lo guardado). Permiso `huespedes:gestionar_datos` |
| Derecho de supresión | *Suprimir sus datos*: reemplaza los datos personales y borra los comentarios del huésped. Las reservas conservan fechas y estados sin identificar a la persona. Se bloquea si hay reservas vigentes |
| Seguridad | Contraseñas argon2id, sesiones invalidables, límite de intentos, HTTPS en producción, base sin puerto público |
| Trazabilidad | Auditoría inmutable de cambios, exportaciones y supresiones (sin copiar datos personales) |
| Logs | No registran cuerpos de peticiones, búsquedas (query string) ni cabeceras de autorización. Campos personales redactados por si aparecen en un error |

## Pendiente del hotel

- Política de tratamiento de datos oficial (responsable, NIT, finalidades, canal de atención de titulares, plazos de respuesta).
- Definir por cuánto tiempo se conservan los datos de huéspedes y de solicitudes no confirmadas.
- Verificar las obligaciones de registro de huéspedes que apliquen al hotel (por ejemplo, la Tarjeta de Registro Hotelero) antes de ampliar los datos que se guardan.
