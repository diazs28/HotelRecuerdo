// Identidad del hotel: UN solo lugar para los textos de marca del sitio.
// Fuente: caracterización del negocio entregada por el cliente. Solo se incluyen HECHOS descritos
// allí (nombre, ciudad, origen familiar en 1979, alojamiento + restaurante y pizzería).
//
// Los datos operativos (teléfono, WhatsApp, correo, dirección, redes, horarios, servicios,
// políticas y tarifas) NO viven aquí: se editan en el panel (Configuración) y solo se muestran en
// el sitio cuando la administración los marca como confirmados y publicados.

export const MARCA = {
  nombre: 'Hotel El Recuerdo',
  ciudad: 'Popayán',
  departamento: 'Cauca',
  anioOrigen: 1979,
  lema: 'Alojamiento y mesa familiar en Popayán',
  historia: {
    // TODO cliente: validar la redacción de la historia con la familia
    origen: 'La historia de El Recuerdo empezó en 1979 con una pizzería familiar en Popayán.',
    hoy: 'Hoy la misma empresa familiar combina alojamiento con restaurante y pizzería, con la atención personal de un hotel tradicional.',
  },
  // Para quién está pensado (según la caracterización)
  publico: [
    'Viajes de trabajo',
    'Visitas por salud o asuntos académicos',
    'Turistas que llegan a conocer la ciudad',
    'Grupos',
  ],
} as const;

export const ANIOS_DE_HISTORIA = (anioActual: number) => anioActual - MARCA.anioOrigen;

// Centro de Popayán (dato geográfico público de la ciudad, no la dirección del hotel)
export const COORDENADAS_CIUDAD = { latitud: '2,4448° N', longitud: '76,6147° O' } as const;
