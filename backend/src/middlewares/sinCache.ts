import type { RequestHandler } from 'express';

// Respuestas con datos personales, pedidos, tokens o información administrativa: ni el navegador
// ni proxies intermedios deben guardarlas (p. ej. un equipo compartido o un proxy corporativo).
export const sinCache: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
