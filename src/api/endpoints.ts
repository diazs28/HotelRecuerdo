import { peticion } from './client';
import { MODO_DEMO, publicoDemo } from './demo';
import type { UsuarioSesion } from './session';
import type {
  Ajuste,
  Bloqueo,
  CamasLibres,
  Canal,
  ClaveAjuste,
  DatosPublicos,
  DisponibilidadPublica,
  EstadoReserva,
  Habitacion,
  HuespedDetalle,
  Huesped,
  ListaReservas,
  MapaOcupacion,
  Pagina,
  RegistroAuditoria,
  Reserva,
  ReservaDetalle,
  Roles,
  Tablero,
  TipoHabitacion,
  UsuarioPersonal,
} from './tipos';

const auth = true;

// ---------- Público ----------

const publicoReal = {
  hotel: () => peticion<DatosPublicos>('/publico/hotel'),
  disponibilidad: (q: { fechaEntrada: string; fechaSalida: string; cantidadHuespedes: number }) =>
    peticion<DisponibilidadPublica>('/publico/disponibilidad', { query: { ...q } }),
  enviarSolicitud: (body: unknown, claveIdempotencia: string) =>
    peticion<{ codigo: string | null; estado: 'SOLICITUD'; mensaje: string }>(
      '/publico/solicitudes',
      { method: 'POST', body, headers: { 'Idempotency-Key': claveIdempotencia } },
    ),
};

// En modo demostración el sitio público no llama a la API (ver api/demo.ts)
export const publico: typeof publicoReal = MODO_DEMO ? publicoDemo : publicoReal;

// ---------- Sesión ----------

export const sesionApi = {
  login: (email: string, password: string) =>
    peticion<{ token: string; expiraEn: string; usuario: UsuarioSesion }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  logout: () => peticion<void>('/auth/logout', { method: 'POST', auth }),
  me: () => peticion<{ usuario: UsuarioSesion }>('/auth/me', { auth }),
  cambiarPassword: (passwordActual: string, passwordNueva: string) =>
    peticion<{ token: string; expiraEn: string }>('/auth/password', {
      method: 'POST',
      body: { passwordActual, passwordNueva },
      auth,
    }),
};

// ---------- Panel ----------

export interface FiltrosReservas {
  q?: string;
  estado?: EstadoReserva[];
  desde?: string;
  hasta?: string;
  canalId?: string;
  orden?: 'entrada' | 'creacion';
  pagina?: number;
  porPagina?: number;
}

export const admin = {
  tablero: () => peticion<Tablero>('/admin/tablero', { auth }),

  reservas: (f: FiltrosReservas) =>
    peticion<ListaReservas>('/admin/reservas', { auth, query: { ...f } }),
  reserva: (id: string) => peticion<ReservaDetalle>(`/admin/reservas/${id}`, { auth }),
  crearReserva: (body: unknown, clave: string) =>
    peticion<Reserva>('/admin/reservas', {
      method: 'POST',
      body,
      auth,
      headers: { 'Idempotency-Key': clave },
    }),
  editarReserva: (id: string, body: unknown) =>
    peticion<Reserva>(`/admin/reservas/${id}`, { method: 'PATCH', body, auth }),
  cambiarEstado: (id: string, estado: EstadoReserva, motivo?: string) =>
    peticion<Reserva>(`/admin/reservas/${id}/estado`, {
      method: 'POST',
      body: { estado, ...(motivo ? { motivo } : {}) },
      auth,
    }),
  asignarCamas: (id: string, body: { camaIds?: string[]; habitacionIds?: string[] }) =>
    peticion<Reserva>(`/admin/reservas/${id}/camas`, { method: 'POST', body, auth }),
  quitarCama: (id: string, camaId: string) =>
    peticion<Reserva>(`/admin/reservas/${id}/camas/${camaId}`, { method: 'DELETE', auth }),

  habitaciones: (incluirInactivas = false) =>
    peticion<{
      resumen: { habitaciones: number; camas: number; plazas: number };
      habitaciones: Habitacion[];
    }>('/admin/habitaciones', { auth, query: { incluirInactivas } }),
  crearHabitacion: (body: unknown) =>
    peticion<Habitacion>('/admin/habitaciones', { method: 'POST', body, auth }),
  editarHabitacion: (id: string, body: unknown) =>
    peticion<Habitacion>(`/admin/habitaciones/${id}`, { method: 'PATCH', body, auth }),
  crearCama: (habitacionId: string, body: unknown) =>
    peticion<Habitacion>(`/admin/habitaciones/${habitacionId}/camas`, {
      method: 'POST',
      body,
      auth,
    }),
  editarCama: (habitacionId: string, camaId: string, body: unknown) =>
    peticion<Habitacion>(`/admin/habitaciones/${habitacionId}/camas/${camaId}`, {
      method: 'PATCH',
      body,
      auth,
    }),

  bloqueos: (q: { habitacionId?: string; vigentes?: boolean }) =>
    peticion<Bloqueo[]>('/admin/bloqueos', { auth, query: { ...q } }),
  crearBloqueo: (body: unknown) =>
    peticion<Bloqueo>('/admin/bloqueos', { method: 'POST', body, auth }),
  liberarBloqueo: (id: string) =>
    peticion<Bloqueo>(`/admin/bloqueos/${id}/liberar`, { method: 'POST', auth }),

  mapa: (desde: string, hasta: string) =>
    peticion<MapaOcupacion>('/admin/disponibilidad', { auth, query: { desde, hasta } }),
  camasLibres: (fechaEntrada: string, fechaSalida: string, excluirReservaId?: string) =>
    peticion<CamasLibres>('/admin/disponibilidad/camas-libres', {
      auth,
      query: { fechaEntrada, fechaSalida, excluirReservaId },
    }),

  huespedes: (q: { q?: string; pagina?: number }) =>
    peticion<Pagina & { huespedes: Array<Huesped & { reservas: number }> }>('/admin/huespedes', {
      auth,
      query: { ...q },
    }),
  huesped: (id: string) => peticion<HuespedDetalle>(`/admin/huespedes/${id}`, { auth }),
  editarHuesped: (id: string, body: unknown) =>
    peticion<HuespedDetalle>(`/admin/huespedes/${id}`, { method: 'PATCH', body, auth }),
  exportarHuesped: (id: string) =>
    peticion<Record<string, unknown>>(`/admin/huespedes/${id}/exportar`, { auth }),
  anonimizarHuesped: (id: string) =>
    peticion<void>(`/admin/huespedes/${id}/anonimizar`, { method: 'POST', auth }),

  ajustes: () => peticion<Ajuste[]>('/admin/configuracion/ajustes', { auth }),
  guardarAjuste: (
    clave: ClaveAjuste,
    body: { valor: Record<string, unknown>; confirmado: boolean; publicado: boolean },
  ) => peticion<Ajuste>(`/admin/configuracion/ajustes/${clave}`, { method: 'PUT', body, auth }),
  tiposHabitacion: () =>
    peticion<TipoHabitacion[]>('/admin/configuracion/tipos-habitacion', { auth }),
  crearTipo: (body: unknown) =>
    peticion<TipoHabitacion>('/admin/configuracion/tipos-habitacion', {
      method: 'POST',
      body,
      auth,
    }),
  editarTipo: (id: string, body: unknown) =>
    peticion<TipoHabitacion>(`/admin/configuracion/tipos-habitacion/${id}`, {
      method: 'PATCH',
      body,
      auth,
    }),
  canales: () => peticion<Canal[]>('/admin/configuracion/canales', { auth }),
  crearCanal: (body: unknown) =>
    peticion<Canal>('/admin/configuracion/canales', { method: 'POST', body, auth }),
  editarCanal: (id: string, body: unknown) =>
    peticion<Canal>(`/admin/configuracion/canales/${id}`, { method: 'PATCH', body, auth }),

  personal: () =>
    peticion<Array<{ id: string; nombre: string }>>('/admin/usuarios/personal', { auth }),
  usuarios: () => peticion<UsuarioPersonal[]>('/admin/usuarios', { auth }),
  crearUsuario: (body: unknown) =>
    peticion<UsuarioPersonal>('/admin/usuarios', { method: 'POST', body, auth }),
  editarUsuario: (id: string, body: unknown) =>
    peticion<UsuarioPersonal>(`/admin/usuarios/${id}`, { method: 'PATCH', body, auth }),
  roles: () => peticion<Roles>('/admin/roles', { auth }),
  permisosRol: (id: string, permisos: string[]) =>
    peticion<Roles['roles'][number]>(`/admin/roles/${id}/permisos`, {
      method: 'PUT',
      body: { permisos },
      auth,
    }),

  auditoria: (q: { entidad?: string; pagina?: number }) =>
    peticion<Pagina & { registros: RegistroAuditoria[] }>('/admin/auditoria', {
      auth,
      query: { ...q },
    }),
};
