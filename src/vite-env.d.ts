/// <reference types="vite/client" />

interface ImportMetaEnv {
  // "true" publica el sitio en modo demostración, sin API ni base de datos (ver src/api/demo.ts)
  readonly VITE_MODO_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
