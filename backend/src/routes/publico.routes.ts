import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { crearLimiteDisponibilidad, crearLimiteSolicitudes } from '../middlewares/rateLimit.js';
import { sinCache } from '../middlewares/sinCache.js';
import {
  claveIdempotenciaSchema,
  disponibilidadPublicaQuerySchema,
  solicitudPublicaSchema,
  type DisponibilidadPublicaQuery,
  type SolicitudPublicaInput,
} from '../schemas/publico.schema.js';
import { crearSolicitud, datosPublicos } from '../services/publico.service.js';
import { disponibilidadPublica } from '../services/disponibilidad.service.js';

// Sitio público — /api/publico (sin autenticación)
export const publicoRouter = Router();

publicoRouter.get('/hotel', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await datosPublicos());
});

publicoRouter.get(
  '/disponibilidad',
  sinCache,
  crearLimiteDisponibilidad(),
  validate(disponibilidadPublicaQuerySchema, 'query'),
  async (req, res) => {
    const q = req.query as unknown as DisponibilidadPublicaQuery;
    res.json(await disponibilidadPublica(q.fechaEntrada, q.fechaSalida, q.cantidadHuespedes));
  },
);

publicoRouter.post(
  '/solicitudes',
  sinCache,
  crearLimiteSolicitudes(),
  validate(solicitudPublicaSchema),
  async (req, res) => {
    const clave = claveIdempotenciaSchema.parse(req.get('Idempotency-Key'));
    const r = await crearSolicitud(req.body as SolicitudPublicaInput, clave);
    res.status(r.creada ? 201 : 200).json(r.cuerpo);
  },
);
