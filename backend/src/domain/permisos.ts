// Catálogo de permisos del sistema (recurso:accion). Los roles y su relación con estos permisos
// viven en la base de datos y el administrador los puede cambiar desde el panel.

export const PERMISOS = {
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
} as const;

export type CodigoPermiso = keyof typeof PERMISOS;

export const CODIGOS_PERMISO = Object.keys(PERMISOS) as CodigoPermiso[];

export function esCodigoPermiso(valor: string): valor is CodigoPermiso {
  return Object.hasOwn(PERMISOS, valor);
}

export const ROL_ADMINISTRADOR = 'administrador';
// El rol administrador nunca puede perder la gestión de usuarios (evita quedar sin acceso)
export const PERMISO_INDISPENSABLE_ADMIN: CodigoPermiso = 'usuarios:gestionar';

// Roles iniciales. SUPUESTO: la administración debe confirmar los cargos reales y sus permisos;
// después se ajustan desde el panel (Configuración → Roles) sin tocar código.
export const ROLES_INICIALES: Record<
  string,
  { nombre: string; descripcion: string; permisos: readonly CodigoPermiso[] }
> = {
  [ROL_ADMINISTRADOR]: {
    nombre: 'Administrador',
    descripcion: 'Acceso completo, incluida la configuración, los usuarios y la auditoría',
    permisos: CODIGOS_PERMISO,
  },
  recepcion: {
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
};
