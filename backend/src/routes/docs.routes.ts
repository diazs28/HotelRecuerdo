import express, { Router } from 'express';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { construirOpenApi } from '../docs/openapi.js';

// Swagger UI en /api/docs. Los archivos salen del paquete swagger-ui-dist (sin CDN externo, así
// la CSP solo permite 'self'). Se monta solo si API_DOCS_ENABLED (por defecto, fuera de producción).
const require = createRequire(import.meta.url);
const RUTA_SWAGGER_UI = dirname(require.resolve('swagger-ui-dist/package.json'));
const ARCHIVOS_PERMITIDOS = new Set(['swagger-ui.css', 'swagger-ui-bundle.js']);

export const docsRouter = Router();

let documento: ReturnType<typeof construirOpenApi> | undefined;

docsRouter.get('/openapi.json', (_req, res) => {
  documento ??= construirOpenApi();
  res.json(documento);
});

// Solo los dos archivos que usa la página (no se expone todo el paquete)
docsRouter.use(
  '/assets',
  (req, res, next) => (ARCHIVOS_PERMITIDOS.has(req.path.slice(1)) ? next() : res.status(404).end()),
  express.static(RUTA_SWAGGER_UI, { index: false, fallthrough: false, maxAge: '1d' }),
);

docsRouter.get('/swagger-init.js', (_req, res) => {
  res
    .type('application/javascript')
    .send(
      `window.ui = SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui', persistAuthorization: false });`,
    );
});

docsRouter.get('/', (_req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      // Swagger UI aplica estilos en línea a sus componentes
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hotel El Recuerdo — API</title>
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/swagger-init.js"></script>
</body>
</html>`);
});
