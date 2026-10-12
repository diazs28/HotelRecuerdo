import { Router, type Request } from 'express';
import { validate } from '../middlewares/validate.js';
import { requirePermiso, tienePermiso, usuarioDe } from '../middlewares/auth.js';
import { idParamSchema, type IdParam } from '../schemas/comun.schema.js';
import {
  actualizarReservaSchema,
  asignarCamasSchema,
  cambiarEstadoSchema,
  crearReservaSchema,
  listarReservasQuerySchema,
  quitarCamaParamsSchema,
  type ActualizarReservaInput,
  type AsignarCamasInput,
  type CambiarEstadoInput,
  type CrearReservaInput,
  type ListarReservasQuery,
} from '../schemas/reservas.schema.js';
import { claveIdempotenciaSchema } from '../schemas/publico.schema.js';
import {
  actualizarReserva,
  crearReserva,
  listarReservas,
  obtenerReserva,
} from '../services/reservas.service.js';
import { cambiarEstado } from '../services/reservasEstado.service.js';
import { asignarCamas, quitarCama } from '../services/asignaciones.service.js';
import { AppError } from '../utils/AppError.js';
import type { PermisosDatos } from '../domain/privacidad.js';

// Reservas — /api/admin/reservas (requireUsuario se aplica al montar /admin)
export const reservasRouter = Router();

export function permisosDatos(req: Request): PermisosDatos {
  return {
    verContacto: tienePermiso(req, 'huespedes:ver'),
    verDocumento: tienePermiso(req, 'huespedes:ver_documento'),
  };
}

const id = (req: Request) => (req.params as unknown as IdParam).id;

reservasRouter.get(
  '/',
  requirePermiso('reservas:ver'),
  validate(listarReservasQuerySchema, 'query'),
  async (req, res) => {
    res.json(await listarReservas(req.query as unknown as ListarReservasQuery, permisosDatos(req)));
  },
);

reservasRouter.post(
  '/',
  requirePermiso('reservas:gestionar'),
  validate(crearReservaSchema),
  async (req, res) => {
    const cabecera = req.get('Idempotency-Key');
    const clave = cabecera === undefined ? undefined : claveIdempotenciaSchema.parse(cabecera);
    const r = await crearReserva(
      req.body as CrearReservaInput,
      usuarioDe(req).id,
      clave,
      permisosDatos(req),
    );
    res.status(r.repetida ? 200 : 201).json(r.reserva);
  },
);

reservasRouter.get(
  '/:id',
  requirePermiso('reservas:ver'),
  validate(idParamSchema, 'params'),
  async (req, res) => {
    res.json(await obtenerReserva(id(req), permisosDatos(req)));
  },
);

reservasRouter.patch(
  '/:id',
  requirePermiso('reservas:gestionar'),
  validate(idParamSchema, 'params'),
  validate(actualizarReservaSchema),
  async (req, res) => {
    res.json(
      await actualizarReserva(
        id(req),
        req.body as ActualizarReservaInput,
        usuarioDe(req).id,
        permisosDatos(req),
      ),
    );
  },
);

reservasRouter.post(
  '/:id/estado',
  requirePermiso('reservas:gestionar', 'reservas:cancelar'),
  validate(idParamSchema, 'params'),
  validate(cambiarEstadoSchema),
  async (req, res) => {
    const datos = req.body as CambiarEstadoInput;
    // Cancelar exige su propio permiso; los demás cambios, el de gestión
    const requerido = datos.estado === 'CANCELADA' ? 'reservas:cancelar' : 'reservas:gestionar';
    if (!tienePermiso(req, requerido)) {
      throw new AppError(403, 'No tienes permiso para realizar esta acción', 'FORBIDDEN');
    }
    res.json(await cambiarEstado(id(req), datos, usuarioDe(req).id, permisosDatos(req)));
  },
);

reservasRouter.post(
  '/:id/camas',
  requirePermiso('reservas:gestionar'),
  validate(idParamSchema, 'params'),
  validate(asignarCamasSchema),
  async (req, res) => {
    res.json(
      await asignarCamas(
        id(req),
        req.body as AsignarCamasInput,
        usuarioDe(req).id,
        permisosDatos(req),
      ),
    );
  },
);

reservasRouter.delete(
  '/:id/camas/:camaId',
  requirePermiso('reservas:gestionar'),
  validate(quitarCamaParamsSchema, 'params'),
  async (req, res) => {
    const p = req.params as unknown as { id: string; camaId: string };
    res.json(await quitarCama(p.id, p.camaId, usuarioDe(req).id, permisosDatos(req)));
  },
);
