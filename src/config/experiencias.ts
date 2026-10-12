// Planes por motivo de viaje ("¿A qué vienes a Popayán?"). No son paquetes con precio: orientan
// la solicitud y la dejan escrita para que el equipo del hotel responda mejor.
// Los motivos salen de la caracterización del negocio (MARCA.publico).

import type { ClaveMaqueta } from './habitaciones';

export type ClaveExperiencia = 'trabajo' | 'salud' | 'turismo' | 'grupos';

export interface Experiencia {
  clave: ClaveExperiencia;
  pestana: string;
  palabra: string; // palabra gigante de fondo
  titulo: string;
  texto: string;
  preguntas: string[]; // lo que conviene contar en la solicitud
  sugerida: ClaveMaqueta;
  color: string;
  color2: string;
}

export const EXPERIENCIAS: Experiencia[] = [
  {
    clave: 'trabajo',
    pestana: 'Trabajo',
    palabra: 'TRABAJO',
    titulo: 'Llegar, descansar y rendir',
    texto:
      'Una habitación tranquila para dormir bien entre reuniones, con restaurante en la misma casa para no perder tiempo al final del día.',
    preguntas: [
      'Hora aproximada de llegada',
      'Si necesitas factura a nombre de una empresa',
      'Horario del desayuno',
    ],
    sugerida: 'sencilla',
    color: '#5cc59a',
    color2: '#1f6f5a',
  },
  {
    clave: 'salud',
    pestana: 'Salud y estudio',
    palabra: 'CALMA',
    titulo: 'Cuando el motivo del viaje pesa, que el lugar no',
    texto:
      'Para quienes llegan a Popayán por citas médicas, tratamientos, exámenes o trámites académicos, solos o con un acompañante.',
    preguntas: [
      'Cuántas noches crees que vas a necesitar',
      'Si viajas con acompañante',
      'Si las fechas pueden cambiar',
    ],
    sugerida: 'doble',
    color: '#8fb8ff',
    color2: '#2b4f8f',
  },
  {
    clave: 'turismo',
    pestana: 'Turismo',
    palabra: 'CIUDAD',
    titulo: 'La Ciudad Blanca, a pie',
    texto:
      'Popayán es conocida por su centro histórico de casas blancas, su Semana Santa —Patrimonio Inmaterial de la Humanidad— y una cocina que la UNESCO reconoció como Ciudad de la Gastronomía.',
    preguntas: [
      'Si vienes en Semana Santa u otra fecha especial',
      'Cuántas personas viajan',
      'Si llegas en carro',
    ],
    sugerida: 'doble',
    color: '#ffc477',
    color2: '#b0642a',
  },
  {
    clave: 'grupos',
    pestana: 'Grupos',
    palabra: 'JUNTOS',
    titulo: 'Viajar juntos, quedarse juntos',
    texto:
      'Equipos de trabajo, delegaciones, familias grandes. Cuéntanos cuántas personas viajan y el equipo del hotel revisa cómo distribuir las camas.',
    preguntas: [
      'Número total de personas',
      'Si hay menores de edad',
      'Si necesitan comidas para el grupo',
    ],
    sugerida: 'multiple',
    color: '#f48a6a',
    color2: '#9a3b2b',
  },
];

export const experienciaPorClave = (clave: string | null) =>
  EXPERIENCIAS.find((e) => e.clave === clave) ?? null;
