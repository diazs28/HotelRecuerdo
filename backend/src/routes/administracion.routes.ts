import { Router, type Request } from 'express';
import { validate } from '../middlewares/validate.js';
import { requirePermiso, usuarioDe } from '../middlewares/auth.js';
import { idParamSchema, type IdParam } from '../schemas/comun.schema.js';
import {
  actualizarHuespedSchema,
  listarHuespedesQuerySchema,
  type ActualizarHuespedInput,
  type ListarHuespedesQuery,
} from '../schemas/huespedes.schema.js';
import {
  claveAjusteParamSchema,
  guardarAjusteSchema,
  type ClaveAjuste,
  type GuardarAjusteInput,
} from '../schemas/ajustes.schema.js';
import {
  actualizarCanalSchema,
  actualizarTipoHabitacionSchema,
  actualizarUsuarioSchema,
  canalSchema,
  crearUsuarioSchema,
  listarAuditoriaQuerySchema,
  permisosRolSchema,
  tipoHabitacionSchema,
  type ActualizarCanalInput,
  type ActualizarTipoHabitacionInput,
  type ActualizarUsuarioInput,
  type CanalInput,
  type CrearUsuarioInput,
  type PermisosRolInput,
  type TipoHabitacionInput,
} from '../schemas/administracion.schema.js';
import {
  actualizarHuesped,
  anonimizarHuesped,
  exportarHuesped,
  listarHuespedes,
  obtenerHuesped,
} from '../services/huespedes.service.js';
import {
  actualizarCanal,
  actualizarTipoHabitacion,
  crearCanal,
  crearTipoHabitacion,
  guardarAjuste,
  listarAjustes,
  listarCanales,
  listarTiposHabitacion,
} from '../services/configuracion.service.js';
import {
  actualizarPermisosRol,
  actualizarUsuario,
  crearUsuario,
  listarRoles,
  listarUsuarios,
} from '../services/usuarios.service.js';
import { listarAuditoria } from '../services/auditoria.service.js';
import { tablero } from '../services/tablero.service.js';
import { permisosDatos } from './reservas.routes.js';

const id = (req: Request) => (req.params as unknown as IdParam).id;

// ---------- Tablero — /api/admin/tablero ----------
export const tableroRouter = Router();

tableroRouter.get('/', requirePermiso('tablero:ver'), async (req, res) => {
  res.json(await tablero(permisosDatos(req)));
});

// ---------- Huéspedes — /api/admin/huespedes ----------
export const huespedesRouter = Router();

huespedesRouter.get(
  '/',
  requirePermiso('huespedes:ver', 'reservas:ver'),
  validate(listarHuespedesQuerySchema, 'query'),
  async (req, res) => {
    res.json(
      await listarHuespedes(req.query as unknown as ListarHuespedesQuery, permisosDatos(req)),
    );
  },
);

huespedesRouter.get(
  '/:id',
  requirePermiso('huespedes:ver', 'reservas:ver'),
  validate(idParamSchema, 'params'),
  async (req, res) => {
    res.json(await obtenerHuesped(id(req), permisosDatos(req)));
  },
);

huespedesRouter.patch(
  '/:id',
  requirePermiso('reservas:gestionar'),
  validate(idParamSchema, 'params'),
  validate(actualizarHuespedSchema),
  async (req, res) => {
    res.json(
      await actualizarHuesped(
        id(req),
        req.body as ActualizarHuespedInput,
        usuarioDe(req).id,
        permisosDatos(req),
      ),
    );
  },
);

huespedesRouter.get(
  '/:id/exportar',
  requirePermiso('huespedes:gestionar_datos'),
  validate(idParamSchema, 'params'),
  async (req, res) => {
    res.json(await exportarHuesped(id(req), usuarioDe(req).id));
  },
);

huespedesRouter.post(
  '/:id/anonimizar',
  requirePermiso('huespedes:gestionar_datos'),
  validate(idParamSchema, 'params'),
  async (req, res) => {
    await anonimizarHuesped(id(req), usuarioDe(req).id);
    res.status(204).end();
  },
);

// ---------- Configuración — /api/admin/configuracion ----------
export const configuracionRouter = Router();

// Lectura de catálogos: cualquier persona del personal (formularios de reservas y habitaciones)
const verCatalogos = requirePermiso('reservas:ver', 'habitaciones:ver', 'configuracion:gestionar');
configuracionRouter.get('/tipos-habitacion', verCatalogos, async (_req, res) => {
  res.json(await listarTiposHabitacion());
});
configuracionRouter.get('/canales', verCatalogos, async (_req, res) => {
  res.json(await listarCanales());
});

configuracionRouter.get(
  '/ajustes',
  requirePermiso('configuracion:gestionar'),
  async (_req, res) => {
    res.json(await listarAjustes());
  },
);

configuracionRouter.put(
  '/ajustes/:clave',
  requirePermiso('configuracion:gestionar'),
  validate(claveAjusteParamSchema, 'params'),
  validate(guardarAjusteSchema),
  async (req, res) => {
    const { clave } = req.params as unknown as { clave: ClaveAjuste };
    res.json(await guardarAjuste(clave, req.body as GuardarAjusteInput, usuarioDe(req).id));
  },
);

configuracionRouter.post(
  '/tipos-habitacion',
  requirePermiso('configuracion:gestionar'),
  validate(tipoHabitacionSchema),
  async (req, res) => {
    res
      .status(201)
      .json(await crearTipoHabitacion(req.body as TipoHabitacionInput, usuarioDe(req).id));
  },
);

configuracionRouter.patch(
  '/tipos-habitacion/:id',
  requirePermiso('configuracion:gestionar'),
  validate(idParamSchema, 'params'),
  validate(actualizarTipoHabitacionSchema),
  async (req, res) => {
    res.json(
      await actualizarTipoHabitacion(
        id(req),
        req.body as ActualizarTipoHabitacionInput,
        usuarioDe(req).id,
      ),
    );
  },
);

configuracionRouter.post(
  '/canales',
  requirePermiso('configuracion:gestionar'),
  validate(canalSchema),
  async (req, res) => {
    res.status(201).json(await crearCanal(req.body as CanalInput, usuarioDe(req).id));
  },
);

configuracionRouter.patch(
  '/canales/:id',
  requirePermiso('configuracion:gestionar'),
  validate(idParamSchema, 'params'),
  validate(actualizarCanalSchema),
  async (req, res) => {
    res.json(await actualizarCanal(id(req), req.body as ActualizarCanalInput, usuarioDe(req).id));
  },
);

// ---------- Usuarios y roles — /api/admin/usuarios, /api/admin/roles ----------
export const usuariosRouter = Router();

// Lista corta para elegir responsable de una reserva
usuariosRouter.get('/personal', requirePermiso('reservas:ver'), async (_req, res) => {
  const usuarios = await listarUsuarios();
  res.json(usuarios.filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre })));
});

usuariosRouter.get('/', requirePermiso('usuarios:gestionar'), async (_req, res) => {
  res.json(await listarUsuarios());
});

usuariosRouter.post(
  '/',
  requirePermiso('usuarios:gestionar'),
  validate(crearUsuarioSchema),
  async (req, res) => {
    res.status(201).json(await crearUsuario(req.body as CrearUsuarioInput, usuarioDe(req).id));
  },
);

usuariosRouter.patch(
  '/:id',
  requirePermiso('usuarios:gestionar'),
  validate(idParamSchema, 'params'),
  validate(actualizarUsuarioSchema),
  async (req, res) => {
    res.json(
      await actualizarUsuario(id(req), req.body as ActualizarUsuarioInput, usuarioDe(req).id),
    );
  },
);

export const rolesRouter = Router();

rolesRouter.get('/', requirePermiso('usuarios:gestionar'), async (_req, res) => {
  res.json(await listarRoles());
});

rolesRouter.put(
  '/:id/permisos',
  requirePermiso('usuarios:gestionar'),
  validate(idParamSchema, 'params'),
  validate(permisosRolSchema),
  async (req, res) => {
    res.json(await actualizarPermisosRol(id(req), req.body as PermisosRolInput, usuarioDe(req).id));
  },
);

// ---------- Auditoría — /api/admin/auditoria ----------
export const auditoriaRouter = Router();

auditoriaRouter.get(
  '/',
  requirePermiso('auditoria:ver'),
  validate(listarAuditoriaQuerySchema, 'query'),
  async (req, res) => {
    res.json(
      await listarAuditoria(
        req.query as unknown as {
          entidad?: string;
          entidadId?: string;
          usuarioId?: string;
          pagina: number;
          porPagina: number;
        },
      ),
    );
  },
);
