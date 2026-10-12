import { Router, type Request } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { requirePermiso, tienePermiso, usuarioDe } from '../middlewares/auth.js';
import { idParamSchema, type IdParam } from '../schemas/comun.schema.js';
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
  type ActualizarCamaInput,
  type ActualizarHabitacionInput,
  type CrearBloqueoInput,
  type CrearCamaInput,
  type CrearHabitacionInput,
} from '../schemas/habitaciones.schema.js';
import {
  actualizarCama,
  actualizarHabitacion,
  crearCama,
  crearHabitacion,
  listarHabitaciones,
  obtenerHabitacion,
  resumenInventario,
} from '../services/habitaciones.service.js';
import { crearBloqueo, liberarBloqueo, listarBloqueos } from '../services/bloqueos.service.js';
import { camasLibres, mapaOcupacion } from '../services/disponibilidad.service.js';

const id = (req: Request) => (req.params as unknown as IdParam).id;

// ---------- Habitaciones y camas — /api/admin/habitaciones ----------
export const habitacionesRouter = Router();

habitacionesRouter.get(
  '/',
  requirePermiso('habitaciones:ver'),
  validate(listarHabitacionesQuerySchema, 'query'),
  async (req, res) => {
    const q = req.query as unknown as { incluirInactivas: boolean };
    const [habitaciones, resumen] = await Promise.all([
      listarHabitaciones(q.incluirInactivas),
      resumenInventario(),
    ]);
    res.json({ resumen, habitaciones });
  },
);

habitacionesRouter.post(
  '/',
  requirePermiso('habitaciones:gestionar'),
  validate(crearHabitacionSchema),
  async (req, res) => {
    res
      .status(201)
      .json(await crearHabitacion(req.body as CrearHabitacionInput, usuarioDe(req).id));
  },
);

habitacionesRouter.get(
  '/:id',
  requirePermiso('habitaciones:ver'),
  validate(idParamSchema, 'params'),
  async (req, res) => {
    res.json(await obtenerHabitacion(id(req)));
  },
);

habitacionesRouter.patch(
  '/:id',
  requirePermiso('habitaciones:gestionar'),
  validate(idParamSchema, 'params'),
  validate(actualizarHabitacionSchema),
  async (req, res) => {
    res.json(
      await actualizarHabitacion(id(req), req.body as ActualizarHabitacionInput, usuarioDe(req).id),
    );
  },
);

habitacionesRouter.post(
  '/:id/camas',
  requirePermiso('habitaciones:gestionar'),
  validate(idParamSchema, 'params'),
  validate(crearCamaSchema),
  async (req, res) => {
    res.status(201).json(await crearCama(id(req), req.body as CrearCamaInput, usuarioDe(req).id));
  },
);

const camaParamsSchema = z.strictObject({ id: z.uuid(), camaId: z.uuid() });

habitacionesRouter.patch(
  '/:id/camas/:camaId',
  requirePermiso('habitaciones:gestionar'),
  validate(camaParamsSchema, 'params'),
  validate(actualizarCamaSchema),
  async (req, res) => {
    const p = req.params as unknown as { id: string; camaId: string };
    res.json(
      await actualizarCama(p.id, p.camaId, req.body as ActualizarCamaInput, usuarioDe(req).id),
    );
  },
);

// ---------- Bloqueos y mantenimiento — /api/admin/bloqueos ----------
export const bloqueosRouter = Router();

bloqueosRouter.get(
  '/',
  requirePermiso('habitaciones:ver'),
  validate(listarBloqueosQuerySchema, 'query'),
  async (req, res) => {
    res.json(
      await listarBloqueos(req.query as unknown as { habitacionId?: string; vigentes: boolean }),
    );
  },
);

bloqueosRouter.post(
  '/',
  requirePermiso('bloqueos:gestionar'),
  validate(crearBloqueoSchema),
  async (req, res) => {
    res.status(201).json(await crearBloqueo(req.body as CrearBloqueoInput, usuarioDe(req).id));
  },
);

bloqueosRouter.post(
  '/:id/liberar',
  requirePermiso('bloqueos:gestionar'),
  validate(idParamSchema, 'params'),
  async (req, res) => {
    res.json(await liberarBloqueo(id(req), usuarioDe(req).id));
  },
);

// ---------- Disponibilidad — /api/admin/disponibilidad ----------
export const disponibilidadRouter = Router();

disponibilidadRouter.get(
  '/',
  requirePermiso('habitaciones:ver', 'reservas:ver'),
  validate(disponibilidadQuerySchema, 'query'),
  async (req, res) => {
    const q = req.query as unknown as { desde: string; hasta: string };
    res.json(
      await mapaOcupacion(q.desde, q.hasta, { verNombres: tienePermiso(req, 'huespedes:ver') }),
    );
  },
);

disponibilidadRouter.get(
  '/camas-libres',
  requirePermiso('habitaciones:ver', 'reservas:ver'),
  validate(camasLibresQuerySchema, 'query'),
  async (req, res) => {
    const q = req.query as unknown as {
      fechaEntrada: string;
      fechaSalida: string;
      excluirReservaId?: string;
    };
    res.json(await camasLibres(q.fechaEntrada, q.fechaSalida, q.excluirReservaId));
  },
);
