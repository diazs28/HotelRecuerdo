// Rutas simuladas: sesión del personal, datos del hotel, tipos, canales, personal, roles y
// auditoría. En la demo la contraseña de los usuarios de ejemplo es "demo".

import type { ClaveAjuste } from '../tipos';
import { ahora, nuevoId, type Db } from './almacen';
import {
  exigir,
  fallo,
  lista,
  noEncontrado,
  numero,
  paginar,
  texto,
  tiene,
  tokenDe,
  usuarioSesion,
  type Contexto,
  type Ruta,
} from './nucleo';
import { PERMISO_INDISPENSABLE_ADMIN, PERMISOS, ROL_ADMINISTRADOR } from './permisos';

export const CONTRASENA_DEMO = 'demo';
const HORAS_SESION = 8;

const ETIQUETAS_AJUSTE: Record<ClaveAjuste, string> = {
  contacto: 'Datos de contacto y redes',
  horarios: 'Horarios de entrada y salida',
  servicio_desayuno: 'Desayuno',
  servicio_parqueadero: 'Parqueadero',
  servicio_wifi: 'Wi-Fi',
  restaurante: 'Restaurante y pizzería',
  politicas: 'Políticas del hotel',
  tarifas: 'Tarifas (informativas)',
  tratamiento_datos: 'Responsable del tratamiento de datos',
};

const ref = (db: Db, id: string | null) => {
  const u = db.usuarios.find((x) => x.id === id);
  return u ? { id: u.id, nombre: u.nombre } : null;
};

function sesionNueva(usuarioId: string) {
  return {
    token: tokenDe(usuarioId),
    expiraEn: new Date(Date.now() + HORAS_SESION * 3_600_000).toISOString(),
  };
}

function login(c: Contexto) {
  const email = texto(c.body, 'email')?.toLowerCase();
  const u = c.db.usuarios.find((x) => x.email === email && x.activo);
  if (!u || c.body.password !== CONTRASENA_DEMO)
    throw fallo(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
  u.ultimoAcceso = ahora();
  return { ...sesionNueva(u.id), usuario: usuarioSesion(c.db, u) };
}

function presentarAjuste(c: Contexto, clave: ClaveAjuste) {
  const a = c.db.ajustes[clave];
  return {
    clave,
    etiqueta: ETIQUETAS_AJUSTE[clave],
    valor: a?.valor ?? {},
    confirmado: a?.confirmado ?? false,
    publicado: a?.publicado ?? false,
    updatedAt: a?.updatedAt ?? null,
    actualizadoPor: ref(c.db, a?.actualizadoPorId ?? null),
  };
}

function guardarAjuste(c: Contexto) {
  const clave = c.params.clave as ClaveAjuste;
  if (!(clave in ETIQUETAS_AJUSTE)) throw noEncontrado('Configuración');
  const valor = c.body.valor;
  if (!valor || typeof valor !== 'object') exigir([{ path: 'valor', message: 'Datos inválidos' }]);
  const confirmado = c.body.confirmado === true;
  c.db.ajustes[clave] = {
    valor: valor as Record<string, unknown>,
    confirmado,
    publicado: confirmado && c.body.publicado === true,
    updatedAt: ahora(),
    actualizadoPorId: c.usuario!.id,
  };
  c.auditar('ajuste.guardado', 'ajuste', clave, {
    clave,
    confirmado,
    publicado: c.db.ajustes[clave]!.publicado,
  });
  return presentarAjuste(c, clave);
}

function guardarTipo(c: Contexto) {
  const t = c.params.id ? c.db.tipos.find((x) => x.id === c.params.id) : undefined;
  if (c.params.id && !t) throw noEncontrado('Tipo de habitación');
  const nombre = texto(c.body, 'nombre') ?? t?.nombre ?? null;
  if (!nombre) exigir([{ path: 'nombre', message: 'Escribe el nombre del tipo' }]);
  if (c.db.tipos.some((x) => x.nombre.toLowerCase() === nombre!.toLowerCase() && x.id !== t?.id))
    exigir([{ path: 'nombre', message: 'Ya existe un tipo con ese nombre' }]);
  const datos = {
    nombre: nombre!,
    descripcion: tiene(c.body, 'descripcion')
      ? texto(c.body, 'descripcion')
      : (t?.descripcion ?? null),
    capacidadSugerida: tiene(c.body, 'capacidadSugerida')
      ? numero(c.body, 'capacidadSugerida')
      : (t?.capacidadSugerida ?? null),
    publicado: tiene(c.body, 'publicado') ? c.body.publicado === true : (t?.publicado ?? false),
    activo: tiene(c.body, 'activo') ? c.body.activo === true : (t?.activo ?? true),
    orden: numero(c.body, 'orden') ?? t?.orden ?? c.db.tipos.length + 1,
  };
  const tipo = t ? Object.assign(t, datos) : { id: nuevoId(), ...datos };
  if (!t) c.db.tipos.push(tipo);
  c.auditar(
    t ? 'tipo_habitacion.actualizado' : 'tipo_habitacion.creado',
    'tipo_habitacion',
    tipo.id,
    { nombre: tipo.nombre },
  );
  return tipo;
}

function guardarCanal(c: Contexto) {
  const k = c.params.id ? c.db.canales.find((x) => x.id === c.params.id) : undefined;
  if (c.params.id && !k) throw noEncontrado('Canal');
  const codigo = texto(c.body, 'codigo') ?? k?.codigo ?? null;
  const nombre = texto(c.body, 'nombre') ?? k?.nombre ?? null;
  const errores = [];
  if (!codigo) errores.push({ path: 'codigo', message: 'Escribe un código corto' });
  else if (c.db.canales.some((x) => x.codigo === codigo && x.id !== k?.id))
    errores.push({ path: 'codigo', message: 'Ese código ya existe' });
  if (!nombre) errores.push({ path: 'nombre', message: 'Escribe el nombre' });
  exigir(errores);
  if (k?.codigo === 'web' && c.body.activo === false)
    throw fallo(
      409,
      'CANAL_WEB',
      'El canal del sitio web no se puede desactivar: lo usan las solicitudes públicas',
    );
  const datos = {
    codigo: codigo!,
    nombre: nombre!,
    activo: tiene(c.body, 'activo') ? c.body.activo === true : (k?.activo ?? true),
    orden: numero(c.body, 'orden') ?? k?.orden ?? c.db.canales.length + 1,
  };
  const canal = k ? Object.assign(k, datos) : { id: nuevoId(), ...datos };
  if (!k) c.db.canales.push(canal);
  c.auditar(k ? 'canal.actualizado' : 'canal.creado', 'canal', canal.id, { codigo: canal.codigo });
  return canal;
}

function presentarUsuario(db: Db, id: string) {
  const u = db.usuarios.find((x) => x.id === id)!;
  const rol = db.roles.find((r) => r.id === u.rolId)!;
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso,
    createdAt: u.createdAt,
    rol: { id: rol.id, codigo: rol.codigo, nombre: rol.nombre },
  };
}

function crearUsuario(c: Contexto) {
  const nombre = texto(c.body, 'nombre');
  const email = texto(c.body, 'email')?.toLowerCase() ?? null;
  const rolId = texto(c.body, 'rolId');
  const errores = [];
  if (!nombre) errores.push({ path: 'nombre', message: 'Escribe el nombre' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errores.push({ path: 'email', message: 'Escribe un correo válido' });
  else if (c.db.usuarios.some((u) => u.email === email))
    errores.push({ path: 'email', message: 'Ya existe un usuario con ese correo' });
  if (!rolId || !c.db.roles.some((r) => r.id === rolId))
    errores.push({ path: 'rolId', message: 'Elige un rol' });
  if ((texto(c.body, 'password') ?? '').length < 10)
    errores.push({ path: 'password', message: 'Mínimo 10 caracteres' });
  exigir(errores);
  const u = {
    id: nuevoId(),
    nombre: nombre!,
    email: email!,
    activo: true,
    ultimoAcceso: null,
    createdAt: ahora(),
    rolId: rolId!,
  };
  c.db.usuarios.push(u);
  c.auditar('usuario.creado', 'usuario', u.id, { rol: rolId });
  return presentarUsuario(c.db, u.id);
}

function editarUsuario(c: Contexto) {
  const u = c.db.usuarios.find((x) => x.id === c.params.id);
  if (!u) throw noEncontrado('Usuario');
  if (
    u.id === c.usuario!.id &&
    (c.body.activo === false || (texto(c.body, 'rolId') && texto(c.body, 'rolId') !== u.rolId))
  )
    throw fallo(409, 'NO_SOBRE_SI_MISMO', 'No puedes desactivarte ni cambiar tu propio rol');
  if (texto(c.body, 'nombre')) u.nombre = texto(c.body, 'nombre')!;
  if (texto(c.body, 'rolId') && c.db.roles.some((r) => r.id === texto(c.body, 'rolId')))
    u.rolId = texto(c.body, 'rolId')!;
  if (tiene(c.body, 'activo')) u.activo = c.body.activo === true;
  c.auditar('usuario.actualizado', 'usuario', u.id);
  return presentarUsuario(c.db, u.id);
}

function cambiarPermisos(c: Contexto) {
  const rol = c.db.roles.find((r) => r.id === c.params.id);
  if (!rol) throw noEncontrado('Rol');
  const permisos = [...new Set(lista(c.body, 'permisos'))];
  if (permisos.some((p) => !(p in PERMISOS)))
    exigir([{ path: 'permisos', message: 'Permiso desconocido' }]);
  if (rol.codigo === ROL_ADMINISTRADOR && !permisos.includes(PERMISO_INDISPENSABLE_ADMIN))
    throw fallo(
      409,
      'PERMISO_INDISPENSABLE',
      'El rol Administrador no puede perder la gestión de usuarios',
    );
  rol.permisos = permisos;
  c.auditar('rol.permisos', 'rol', rol.id, { permisos: permisos.length });
  return { ...rol, usuarios: c.db.usuarios.filter((u) => u.rolId === rol.id).length };
}

export const RUTAS_CONFIGURACION: Ruta[] = [
  { metodo: 'POST', patron: '/auth/login', acceso: 'publico', manejar: login },
  { metodo: 'POST', patron: '/auth/logout', acceso: 'sesion', manejar: () => undefined },
  {
    metodo: 'GET',
    patron: '/auth/me',
    acceso: 'sesion',
    manejar: (c) => ({ usuario: usuarioSesion(c.db, c.usuario!) }),
  },
  {
    metodo: 'POST',
    patron: '/auth/password',
    acceso: 'sesion',
    manejar: (c) => sesionNueva(c.usuario!.id),
  },
  {
    metodo: 'GET',
    patron: '/admin/configuracion/ajustes',
    acceso: ['configuracion:gestionar'],
    manejar: (c) =>
      (Object.keys(ETIQUETAS_AJUSTE) as ClaveAjuste[]).map((k) => presentarAjuste(c, k)),
  },
  {
    metodo: 'PUT',
    patron: '/admin/configuracion/ajustes/:clave',
    acceso: ['configuracion:gestionar'],
    manejar: guardarAjuste,
  },
  {
    metodo: 'GET',
    patron: '/admin/configuracion/tipos-habitacion',
    acceso: ['reservas:ver', 'habitaciones:ver', 'configuracion:gestionar'],
    manejar: (c) =>
      [...c.db.tipos]
        .sort((a, b) => a.orden - b.orden)
        .map((t) => ({
          ...t,
          _count: {
            habitaciones: c.db.habitaciones.filter((h) => h.activa && h.tipoHabitacionId === t.id)
              .length,
          },
        })),
  },
  {
    metodo: 'POST',
    patron: '/admin/configuracion/tipos-habitacion',
    acceso: ['configuracion:gestionar'],
    manejar: guardarTipo,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/configuracion/tipos-habitacion/:id',
    acceso: ['configuracion:gestionar'],
    manejar: guardarTipo,
  },
  {
    metodo: 'GET',
    patron: '/admin/configuracion/canales',
    acceso: ['reservas:ver', 'habitaciones:ver', 'configuracion:gestionar'],
    manejar: (c) => [...c.db.canales].sort((a, b) => a.orden - b.orden),
  },
  {
    metodo: 'POST',
    patron: '/admin/configuracion/canales',
    acceso: ['configuracion:gestionar'],
    manejar: guardarCanal,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/configuracion/canales/:id',
    acceso: ['configuracion:gestionar'],
    manejar: guardarCanal,
  },
  {
    metodo: 'GET',
    patron: '/admin/usuarios/personal',
    acceso: ['reservas:ver'],
    manejar: (c) =>
      c.db.usuarios.filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre })),
  },
  {
    metodo: 'GET',
    patron: '/admin/usuarios',
    acceso: ['usuarios:gestionar'],
    manejar: (c) =>
      [...c.db.usuarios]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((u) => presentarUsuario(c.db, u.id)),
  },
  {
    metodo: 'POST',
    patron: '/admin/usuarios',
    acceso: ['usuarios:gestionar'],
    manejar: crearUsuario,
  },
  {
    metodo: 'PATCH',
    patron: '/admin/usuarios/:id',
    acceso: ['usuarios:gestionar'],
    manejar: editarUsuario,
  },
  {
    metodo: 'GET',
    patron: '/admin/roles',
    acceso: ['usuarios:gestionar'],
    manejar: (c) => ({
      catalogo: Object.entries(PERMISOS).map(([codigo, descripcion]) => ({ codigo, descripcion })),
      roles: c.db.roles.map((r) => ({
        ...r,
        usuarios: c.db.usuarios.filter((u) => u.rolId === r.id).length,
      })),
    }),
  },
  {
    metodo: 'PUT',
    patron: '/admin/roles/:id/permisos',
    acceso: ['usuarios:gestionar'],
    manejar: cambiarPermisos,
  },
  {
    metodo: 'GET',
    patron: '/admin/auditoria',
    acceso: ['auditoria:ver'],
    manejar: (c) => {
      const pagina = Number(c.query.pagina ?? 1);
      const registros = c.db.auditoria.filter(
        (a) => !c.query.entidad || a.entidad === c.query.entidad,
      );
      return {
        total: registros.length,
        pagina,
        porPagina: 50,
        registros: paginar(registros, pagina, 50).map((a) => ({
          ...a,
          usuario: ref(c.db, a.usuarioId),
        })),
      };
    },
  },
];
