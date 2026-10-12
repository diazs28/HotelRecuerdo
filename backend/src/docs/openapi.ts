import { z, type ZodType } from 'zod';
import { idParamSchema } from '../schemas/comun.schema.js';
import {
  claveIdempotenciaSchema,
  disponibilidadPublicaQuerySchema,
  solicitudPublicaSchema,
} from '../schemas/publico.schema.js';
import {
  actualizarReservaSchema,
  asignarCamasSchema,
  cambiarEstadoSchema,
  crearReservaSchema,
  listarReservasQuerySchema,
  quitarCamaParamsSchema,
} from '../schemas/reservas.schema.js';
import {
  actualizarCamaSchema,
  actualizarHabitacionSchema,
  camasLibresQuerySchema,
  crearBloqueoSchema,
  crearCamaSchema,
  crearHabitacionSchema,
  disponibilidadQuerySchema,
  listarBloqueosQuerySchema,
  listarHabitacionesQuerySchema,
} from '../schemas/habitaciones.schema.js';
import {
  actualizarHuespedSchema,
  listarHuespedesQuerySchema,
} from '../schemas/huespedes.schema.js';
import { claveAjusteParamSchema, guardarAjusteSchema } from '../schemas/ajustes.schema.js';
import {
  actualizarCanalSchema,
  actualizarTipoHabitacionSchema,
  actualizarUsuarioSchema,
  cambiarPasswordSchema,
  canalSchema,
  crearUsuarioSchema,
  listarAuditoriaQuerySchema,
  loginSchema,
  permisosRolSchema,
  tipoHabitacionSchema,
} from '../schemas/administracion.schema.js';
import type { CodigoPermiso } from '../domain/permisos.js';

// Documento OpenAPI 3.1 generado a partir de los MISMOS esquemas Zod que validan las rutas
// (z.toJSONSchema de Zod 4): la documentación no duplica definiciones y no se desactualiza.

type Metodo = 'get' | 'post' | 'patch' | 'put' | 'delete';

interface Ruta {
  metodo: Metodo;
  path: string;
  tag: string;
  resumen: string;
  descripcion?: string;
  // null = pública; [] = cualquier usuario autenticado; [...] = alguno de estos permisos
  permisos: readonly CodigoPermiso[] | null;
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  ok: number;
  idempotente?: 'opcional' | 'obligatoria';
  errores?: number[];
}

const camaParams = z.strictObject({ id: z.uuid(), camaId: z.uuid() });

const RUTAS: Ruta[] = [
  // Salud
  {
    metodo: 'get',
    path: '/health',
    tag: 'Salud',
    resumen: 'El proceso responde',
    permisos: null,
    ok: 200,
  },
  {
    metodo: 'get',
    path: '/health/db',
    tag: 'Salud',
    resumen: 'La base de datos responde',
    permisos: null,
    ok: 200,
    errores: [503],
  },

  // Público
  {
    metodo: 'get',
    path: '/publico/hotel',
    tag: 'Sitio público',
    resumen: 'Datos publicados del hotel (solo lo confirmado y publicado) y tipos de habitación',
    permisos: null,
    ok: 200,
  },
  {
    metodo: 'get',
    path: '/publico/disponibilidad',
    tag: 'Sitio público',
    resumen: 'Disponibilidad orientativa por tipo de habitación',
    permisos: null,
    query: disponibilidadPublicaQuerySchema,
    ok: 200,
    errores: [400, 429],
  },
  {
    metodo: 'post',
    path: '/publico/solicitudes',
    tag: 'Sitio público',
    resumen: 'Enviar una solicitud de reserva (no es una reserva confirmada)',
    descripcion:
      'Crea una reserva en estado SOLICITUD sin camas. Requiere la cabecera Idempotency-Key (UUID por intento): repetir el envío devuelve 200 con la misma solicitud. Límite por IP.',
    permisos: null,
    body: solicitudPublicaSchema,
    ok: 201,
    idempotente: 'obligatoria',
    errores: [400, 422, 429, 503],
  },

  // Sesión
  {
    metodo: 'post',
    path: '/auth/login',
    tag: 'Sesión',
    resumen: 'Iniciar sesión del personal',
    permisos: null,
    body: loginSchema,
    ok: 200,
    errores: [400, 401, 429],
  },
  {
    metodo: 'post',
    path: '/auth/logout',
    tag: 'Sesión',
    resumen: 'Cerrar sesión (invalida todos los tokens del usuario)',
    permisos: [],
    ok: 204,
  },
  {
    metodo: 'get',
    path: '/auth/me',
    tag: 'Sesión',
    resumen: 'Perfil y permisos del usuario',
    permisos: [],
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/auth/password',
    tag: 'Sesión',
    resumen: 'Cambiar la propia contraseña',
    permisos: [],
    body: cambiarPasswordSchema,
    ok: 200,
    errores: [400, 429],
  },

  // Tablero
  {
    metodo: 'get',
    path: '/admin/tablero',
    tag: 'Tablero',
    resumen: 'Llegadas, salidas, pendientes, estado de habitaciones e indicadores con su fórmula',
    permisos: ['tablero:ver'],
    ok: 200,
  },

  // Reservas
  {
    metodo: 'get',
    path: '/admin/reservas',
    tag: 'Reservas',
    resumen: 'Buscar reservas (nombre, teléfono, correo o código; estado; fechas)',
    permisos: ['reservas:ver'],
    query: listarReservasQuerySchema,
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/admin/reservas',
    tag: 'Reservas',
    resumen: 'Crear una reserva (opcionalmente con camas)',
    permisos: ['reservas:gestionar'],
    body: crearReservaSchema,
    ok: 201,
    idempotente: 'opcional',
    errores: [409, 422],
  },
  {
    metodo: 'get',
    path: '/admin/reservas/{id}',
    tag: 'Reservas',
    resumen: 'Detalle con camas e historial de cambios',
    permisos: ['reservas:ver'],
    params: idParamSchema,
    ok: 200,
    errores: [404],
  },
  {
    metodo: 'patch',
    path: '/admin/reservas/{id}',
    tag: 'Reservas',
    resumen: 'Editar fechas, huéspedes, canal, notas o responsable',
    descripcion:
      'Si cambian las fechas, las camas asignadas se mueven; si alguna está tomada responde 409 CAMA_NO_DISPONIBLE.',
    permisos: ['reservas:gestionar'],
    params: idParamSchema,
    body: actualizarReservaSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'post',
    path: '/admin/reservas/{id}/estado',
    tag: 'Reservas',
    resumen: 'Cambiar el estado (transiciones validadas)',
    descripcion:
      'Transición inválida o repetida → 409. Confirmar exige camas suficientes. Cancelar exige motivo y el permiso reservas:cancelar, y libera las camas.',
    permisos: ['reservas:gestionar', 'reservas:cancelar'],
    params: idParamSchema,
    body: cambiarEstadoSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'post',
    path: '/admin/reservas/{id}/camas',
    tag: 'Reservas',
    resumen: 'Asignar camas o habitaciones completas',
    permisos: ['reservas:gestionar'],
    params: idParamSchema,
    body: asignarCamasSchema,
    ok: 200,
    errores: [404, 409, 422],
  },
  {
    metodo: 'delete',
    path: '/admin/reservas/{id}/camas/{camaId}',
    tag: 'Reservas',
    resumen: 'Quitar una cama de la reserva',
    permisos: ['reservas:gestionar'],
    params: quitarCamaParamsSchema,
    ok: 200,
    errores: [404, 409],
  },

  // Habitaciones, camas, bloqueos y disponibilidad
  {
    metodo: 'get',
    path: '/admin/habitaciones',
    tag: 'Habitaciones',
    resumen: 'Habitaciones con sus camas y resumen del inventario',
    permisos: ['habitaciones:ver'],
    query: listarHabitacionesQuerySchema,
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/admin/habitaciones',
    tag: 'Habitaciones',
    resumen: 'Crear habitación (con camas iniciales opcionales)',
    permisos: ['habitaciones:gestionar'],
    body: crearHabitacionSchema,
    ok: 201,
    errores: [409, 422],
  },
  {
    metodo: 'get',
    path: '/admin/habitaciones/{id}',
    tag: 'Habitaciones',
    resumen: 'Detalle de una habitación',
    permisos: ['habitaciones:ver'],
    params: idParamSchema,
    ok: 200,
    errores: [404],
  },
  {
    metodo: 'patch',
    path: '/admin/habitaciones/{id}',
    tag: 'Habitaciones',
    resumen: 'Editar o retirar una habitación',
    permisos: ['habitaciones:gestionar'],
    params: idParamSchema,
    body: actualizarHabitacionSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'post',
    path: '/admin/habitaciones/{id}/camas',
    tag: 'Habitaciones',
    resumen: 'Agregar una cama',
    permisos: ['habitaciones:gestionar'],
    params: idParamSchema,
    body: crearCamaSchema,
    ok: 201,
    errores: [404, 409],
  },
  {
    metodo: 'patch',
    path: '/admin/habitaciones/{id}/camas/{camaId}',
    tag: 'Habitaciones',
    resumen: 'Editar o retirar una cama',
    permisos: ['habitaciones:gestionar'],
    params: camaParams,
    body: actualizarCamaSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'get',
    path: '/admin/bloqueos',
    tag: 'Bloqueos',
    resumen: 'Bloqueos y mantenimientos',
    permisos: ['habitaciones:ver'],
    query: listarBloqueosQuerySchema,
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/admin/bloqueos',
    tag: 'Bloqueos',
    resumen: 'Bloquear o poner en mantenimiento una habitación o cama',
    descripcion:
      'Si alguna cama tiene reservas en el periodo responde 409 CAMA_NO_DISPONIBLE con el detalle.',
    permisos: ['bloqueos:gestionar'],
    body: crearBloqueoSchema,
    ok: 201,
    errores: [404, 409, 422],
  },
  {
    metodo: 'post',
    path: '/admin/bloqueos/{id}/liberar',
    tag: 'Bloqueos',
    resumen: 'Liberar un bloqueo desde hoy',
    permisos: ['bloqueos:gestionar'],
    params: idParamSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'get',
    path: '/admin/disponibilidad',
    tag: 'Disponibilidad',
    resumen: 'Mapa de ocupación por habitación y cama (máximo 62 días)',
    permisos: ['habitaciones:ver', 'reservas:ver'],
    query: disponibilidadQuerySchema,
    ok: 200,
    errores: [400],
  },
  {
    metodo: 'get',
    path: '/admin/disponibilidad/camas-libres',
    tag: 'Disponibilidad',
    resumen: 'Camas libres en un rango de fechas',
    permisos: ['habitaciones:ver', 'reservas:ver'],
    query: camasLibresQuerySchema,
    ok: 200,
  },

  // Huéspedes
  {
    metodo: 'get',
    path: '/admin/huespedes',
    tag: 'Huéspedes',
    resumen: 'Buscar huéspedes (datos según permisos)',
    permisos: ['huespedes:ver', 'reservas:ver'],
    query: listarHuespedesQuerySchema,
    ok: 200,
  },
  {
    metodo: 'get',
    path: '/admin/huespedes/{id}',
    tag: 'Huéspedes',
    resumen: 'Detalle y reservas del huésped',
    permisos: ['huespedes:ver', 'reservas:ver'],
    params: idParamSchema,
    ok: 200,
    errores: [404],
  },
  {
    metodo: 'patch',
    path: '/admin/huespedes/{id}',
    tag: 'Huéspedes',
    resumen: 'Corregir datos del huésped',
    permisos: ['reservas:gestionar'],
    params: idParamSchema,
    body: actualizarHuespedSchema,
    ok: 200,
    errores: [404, 409, 422],
  },
  {
    metodo: 'get',
    path: '/admin/huespedes/{id}/exportar',
    tag: 'Huéspedes',
    resumen: 'Exportar los datos del titular (derecho de acceso)',
    permisos: ['huespedes:gestionar_datos'],
    params: idParamSchema,
    ok: 200,
    errores: [404],
  },
  {
    metodo: 'post',
    path: '/admin/huespedes/{id}/anonimizar',
    tag: 'Huéspedes',
    resumen: 'Suprimir los datos personales del titular',
    permisos: ['huespedes:gestionar_datos'],
    params: idParamSchema,
    ok: 204,
    errores: [404, 409],
  },

  // Configuración
  {
    metodo: 'get',
    path: '/admin/configuracion/ajustes',
    tag: 'Configuración',
    resumen: 'Datos del hotel (contacto, servicios, horarios, políticas, tarifas)',
    permisos: ['configuracion:gestionar'],
    ok: 200,
  },
  {
    metodo: 'put',
    path: '/admin/configuracion/ajustes/{clave}',
    tag: 'Configuración',
    resumen: 'Guardar un dato del hotel (publicar exige confirmado)',
    permisos: ['configuracion:gestionar'],
    params: claveAjusteParamSchema,
    body: guardarAjusteSchema,
    ok: 200,
    errores: [400],
  },
  {
    metodo: 'get',
    path: '/admin/configuracion/tipos-habitacion',
    tag: 'Configuración',
    resumen: 'Tipos de habitación',
    permisos: ['reservas:ver', 'habitaciones:ver', 'configuracion:gestionar'],
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/admin/configuracion/tipos-habitacion',
    tag: 'Configuración',
    resumen: 'Crear tipo de habitación',
    permisos: ['configuracion:gestionar'],
    body: tipoHabitacionSchema,
    ok: 201,
    errores: [409],
  },
  {
    metodo: 'patch',
    path: '/admin/configuracion/tipos-habitacion/{id}',
    tag: 'Configuración',
    resumen: 'Editar tipo de habitación',
    permisos: ['configuracion:gestionar'],
    params: idParamSchema,
    body: actualizarTipoHabitacionSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'get',
    path: '/admin/configuracion/canales',
    tag: 'Configuración',
    resumen: 'Canales de origen de las reservas',
    permisos: ['reservas:ver', 'habitaciones:ver', 'configuracion:gestionar'],
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/admin/configuracion/canales',
    tag: 'Configuración',
    resumen: 'Crear canal',
    permisos: ['configuracion:gestionar'],
    body: canalSchema,
    ok: 201,
    errores: [409],
  },
  {
    metodo: 'patch',
    path: '/admin/configuracion/canales/{id}',
    tag: 'Configuración',
    resumen: 'Editar canal',
    permisos: ['configuracion:gestionar'],
    params: idParamSchema,
    body: actualizarCanalSchema,
    ok: 200,
    errores: [404, 409],
  },

  // Usuarios, roles y auditoría
  {
    metodo: 'get',
    path: '/admin/usuarios/personal',
    tag: 'Usuarios',
    resumen: 'Personal activo (para elegir responsable)',
    permisos: ['reservas:ver'],
    ok: 200,
  },
  {
    metodo: 'get',
    path: '/admin/usuarios',
    tag: 'Usuarios',
    resumen: 'Usuarios del personal',
    permisos: ['usuarios:gestionar'],
    ok: 200,
  },
  {
    metodo: 'post',
    path: '/admin/usuarios',
    tag: 'Usuarios',
    resumen: 'Crear usuario',
    permisos: ['usuarios:gestionar'],
    body: crearUsuarioSchema,
    ok: 201,
    errores: [409, 422],
  },
  {
    metodo: 'patch',
    path: '/admin/usuarios/{id}',
    tag: 'Usuarios',
    resumen: 'Editar, desactivar o restablecer contraseña',
    permisos: ['usuarios:gestionar'],
    params: idParamSchema,
    body: actualizarUsuarioSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'get',
    path: '/admin/roles',
    tag: 'Usuarios',
    resumen: 'Roles, sus permisos y el catálogo de permisos',
    permisos: ['usuarios:gestionar'],
    ok: 200,
  },
  {
    metodo: 'put',
    path: '/admin/roles/{id}/permisos',
    tag: 'Usuarios',
    resumen: 'Reemplazar los permisos de un rol',
    permisos: ['usuarios:gestionar'],
    params: idParamSchema,
    body: permisosRolSchema,
    ok: 200,
    errores: [404, 409],
  },
  {
    metodo: 'get',
    path: '/admin/auditoria',
    tag: 'Auditoría',
    resumen: 'Registro de cambios',
    permisos: ['auditoria:ver'],
    query: listarAuditoriaQuerySchema,
    ok: 200,
  },
];

const DESCRIPCION_ERRORES: Record<number, string> = {
  400: 'Datos inválidos (VALIDATION_ERROR con details por campo)',
  401: 'Sin sesión o sesión vencida',
  403: 'Sin permiso',
  404: 'No encontrado',
  409: 'Conflicto de negocio (cama no disponible, transición inválida, capacidad insuficiente...)',
  422: 'Referencia inválida o clave de idempotencia reutilizada con otros datos',
  429: 'Demasiadas solicitudes',
  503: 'Servicio no disponible',
};

function aJsonSchema(schema: ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
  } catch {
    return { type: 'object' };
  }
}

function parametros(schema: ZodType | undefined, ubicacion: 'query' | 'path') {
  if (!schema) return [];
  const js = aJsonSchema(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return Object.entries(js.properties ?? {}).map(([nombre, s]) => ({
    name: nombre,
    in: ubicacion,
    required: ubicacion === 'path' || (js.required ?? []).includes(nombre),
    schema: s,
  }));
}

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
  },
};

export function construirOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of RUTAS) {
    const errores = [
      ...new Set([
        ...(r.errores ?? []),
        ...(r.body || r.query ? [400] : []),
        ...(r.permisos ? [401, 403] : []),
      ]),
    ].sort();
    const descripcionPermisos =
      r.permisos === null
        ? 'Pública.'
        : r.permisos.length === 0
          ? 'Requiere sesión del personal.'
          : `Requiere alguno de estos permisos: ${r.permisos.join(', ')}.`;
    paths[r.path] ??= {};
    paths[r.path]![r.metodo] = {
      tags: [r.tag],
      summary: r.resumen,
      description: [r.descripcion, descripcionPermisos].filter(Boolean).join('\n\n'),
      ...(r.permisos !== null ? { security: [{ bearer: [] }] } : {}),
      parameters: [
        ...parametros(r.params, 'path'),
        ...parametros(r.query, 'query'),
        ...(r.idempotente
          ? [
              {
                name: 'Idempotency-Key',
                in: 'header',
                required: r.idempotente === 'obligatoria',
                schema: aJsonSchema(claveIdempotenciaSchema),
                description: 'UUID por intento: repetir la petición no crea duplicados',
              },
            ]
          : []),
      ],
      ...(r.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: aJsonSchema(r.body) } },
            },
          }
        : {}),
      responses: {
        [r.ok]: { description: r.ok === 204 ? 'Sin contenido' : 'Correcto' },
        ...Object.fromEntries(
          errores.map((s) => [
            s,
            {
              description: DESCRIPCION_ERRORES[s] ?? 'Error',
              content: { 'application/json': { schema: errorSchema } },
            },
          ]),
        ),
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Hotel El Recuerdo — API',
      version: '0.1.0',
      description:
        'API de reservas, habitaciones, camas y huéspedes. Errores con formato { error: { code, message, details? } }. Fechas de calendario en formato AAAA-MM-DD (zona horaria America/Bogota); una reserva ocupa las noches [fechaEntrada, fechaSalida).',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    paths,
  };
}

export const TOTAL_RUTAS_DOCUMENTADAS = RUTAS.length;
