import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { requireUsuario, usuarioDe } from '../middlewares/auth.js';
import { crearLimitePassword, crearLimitesLogin } from '../middlewares/rateLimit.js';
import {
  cambiarPasswordSchema,
  loginSchema,
  type CambiarPasswordInput,
  type LoginInput,
} from '../schemas/administracion.schema.js';
import { cambiarPassword, login, logout, perfil } from '../services/usuarios.service.js';

// Sesión del personal — /api/auth (no hay registro público)
export const authRouter = Router();

authRouter.post('/login', ...crearLimitesLogin(), validate(loginSchema), async (req, res) => {
  res.json(await login(req.body as LoginInput));
});

authRouter.post('/logout', requireUsuario, async (req, res) => {
  await logout(usuarioDe(req).id);
  res.status(204).end();
});

authRouter.get('/me', requireUsuario, async (req, res) => {
  res.json({ usuario: await perfil(usuarioDe(req).id) });
});

authRouter.post(
  '/password',
  requireUsuario,
  crearLimitePassword(),
  validate(cambiarPasswordSchema),
  async (req, res) => {
    res.json(await cambiarPassword(usuarioDe(req).id, req.body as CambiarPasswordInput));
  },
);
