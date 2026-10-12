import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type Origen = 'body' | 'params' | 'query';

// Valida y normaliza req[origen] con un esquema Zod.
// Si falla, el ZodError llega al errorHandler (400 VALIDATION_ERROR).
export function validate(schema: ZodType, origen: Origen = 'body'): RequestHandler {
  return (req, _res, next) => {
    const datos = schema.parse(req[origen] ?? {});
    if (origen === 'body') {
      req.body = datos;
    } else {
      // En Express 5 req.query y req.params son getters: se reemplazan con una propiedad propia
      Object.defineProperty(req, origen, {
        value: datos,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    next();
  };
}
