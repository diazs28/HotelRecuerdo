import type { CodigoPermiso } from '../domain/permisos.js';

// Datos que el middleware de autenticación deja en la request
declare global {
  namespace Express {
    interface Request {
      usuario?: { id: string; rolCodigo: string; permisos: ReadonlySet<CodigoPermiso> };
    }
  }
}

export {};
