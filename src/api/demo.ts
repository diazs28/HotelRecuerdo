// Modo demostración (VITE_MODO_DEMO=true): el sitio y el panel funcionan sin API ni base de datos,
// para mostrarlos a clientes desde un hosting estático (Vercel). api/client.ts entrega cada
// petición a la API simulada de src/api/simulacion, con datos de ejemplo guardados solo en la
// pestaña de quien la visita. Nada se envía al hotel.

export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';
