// Modo demostración (VITE_MODO_DEMO=true): el sitio público funciona sin API ni base de datos,
// para mostrarlo a clientes desde un hosting estático (por ejemplo, Vercel).
// Nada se envía ni se guarda: la solicitud devuelve un código de ejemplo y el panel se desactiva.

import type { DatosPublicos, DisponibilidadPublica } from './tipos';
import { hoyEnHotel, noches } from '../lib/fechas';

export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const publicoDemo = {
  // Sin tipos publicados ni ajustes: el sitio muestra las fichas de referencia y los textos base
  hotel: async (): Promise<DatosPublicos> => ({
    ajustes: {},
    tiposHabitacion: [],
    hoy: hoyEnHotel(),
    diasMaximosAnticipacion: 540,
  }),
  disponibilidad: async (q: {
    fechaEntrada: string;
    fechaSalida: string;
    cantidadHuespedes: number;
  }): Promise<DisponibilidadPublica> => {
    await espera(600);
    return {
      fechaEntrada: q.fechaEntrada,
      fechaSalida: q.fechaSalida,
      noches: noches(q.fechaEntrada, q.fechaSalida),
      hayDisponibilidad: true,
      porTipo: [],
      aviso: 'Versión de demostración: esta consulta no revisa la ocupación real del hotel.',
    };
  },
  enviarSolicitud: async (): Promise<{
    codigo: string | null;
    estado: 'SOLICITUD';
    mensaje: string;
  }> => {
    await espera(900);
    return {
      codigo: `DEMO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      estado: 'SOLICITUD',
      mensaje: 'Versión de demostración: la solicitud no se envió al hotel.',
    };
  },
};
