// Catálogo de permisos y roles iniciales: copia de backend/src/domain/permisos.ts para la
// demostración. Si cambia allá, se actualiza aquí.

export const PERMISOS: Record<string, string> = {
  'tablero:ver': 'Ver el tablero con llegadas, salidas e indicadores',
  'reservas:ver': 'Consultar reservas, solicitudes y su historial',
  'reservas:gestionar': 'Crear y editar reservas, asignar camas y cambiar estados',
  'reservas:cancelar': 'Cancelar reservas',
  'habitaciones:ver': 'Consultar habitaciones, camas y disponibilidad',
  'habitaciones:gestionar': 'Crear, editar y retirar habitaciones y camas',
  'bloqueos:gestionar': 'Bloquear o poner en mantenimiento habitaciones y camas',
  'huespedes:ver': 'Ver los datos de contacto de los huéspedes',
  'huespedes:ver_documento': 'Ver el número de documento completo de los huéspedes',
  'huespedes:gestionar_datos': 'Exportar o anonimizar los datos de un huésped (Ley 1581)',
  'configuracion:gestionar':
    'Editar datos del hotel, servicios, políticas, tipos de habitación y canales',
  'usuarios:gestionar': 'Crear usuarios del personal y configurar roles y permisos',
  'auditoria:ver': 'Consultar la auditoría completa del sistema',
};

export const ROL_ADMINISTRADOR = 'administrador';
export const PERMISO_INDISPENSABLE_ADMIN = 'usuarios:gestionar';

export const ROLES_INICIALES = [
  {
    codigo: ROL_ADMINISTRADOR,
    nombre: 'Administrador',
    descripcion: 'Acceso completo, incluida la configuración, los usuarios y la auditoría',
    permisos: Object.keys(PERMISOS),
  },
  {
    codigo: 'recepcion',
    nombre: 'Recepción',
    descripcion: 'Gestión diaria de solicitudes, reservas, camas y bloqueos',
    permisos: [
      'tablero:ver',
      'reservas:ver',
      'reservas:gestionar',
      'reservas:cancelar',
      'habitaciones:ver',
      'bloqueos:gestionar',
      'huespedes:ver',
    ],
  },
];

// Usuarios de la demostración (correos de ejemplo; la demo no pide contraseña real)
export const USUARIOS_DEMO = [
  { nombre: 'Laura Administradora', email: 'administracion@example.com', rol: ROL_ADMINISTRADOR },
  { nombre: 'Carlos Recepción', email: 'recepcion@example.com', rol: 'recepcion' },
] as const;
