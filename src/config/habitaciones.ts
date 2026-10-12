// Vitrina de habitaciones del sitio público.
//
// Los TIPOS que se ofrecen vienen de la API (Panel → Datos del hotel → Tipos de habitación) y solo
// aparecen cuando la administración los publica. Mientras no haya ninguno publicado, el sitio
// muestra estas fichas como REFERENCIA, sin enlazarlas a un tipo concreto.
//
// Cada ficha se acompaña de una maqueta 3D ILUSTRATIVA (no es la distribución real del hotel).
// TODO cliente: confirmar camas, metros y comodidades de cada tipo, y agregar fotografías propias
// en `fotos` (por ejemplo `/habitaciones/doble-1.webp` dentro de frontend/public). Las fotos reales
// se muestran antes que las vistas de la maqueta en el carrusel.

export type ClaveMaqueta = 'sencilla' | 'doble' | 'triple' | 'multiple';

export interface Foto {
  src: string;
  alt: string;
}

export interface FichaHabitacion {
  clave: ClaveMaqueta;
  nombre: string;
  resumen: string;
  personas: number;
  camas: number; // camas que dibuja la maqueta
  metros: number | null; // TODO cliente
  comodidades: string[]; // TODO cliente: solo lo confirmado por el hotel
  fotos: Foto[]; // TODO cliente
  acento: string; // color de la cobija en la maqueta y del detalle de la tarjeta
}

export const FICHAS: Record<ClaveMaqueta, FichaHabitacion> = {
  sencilla: {
    clave: 'sencilla',
    nombre: 'Habitación sencilla',
    resumen: 'Para quien viaja solo: una cama, silencio y un lugar donde dejar el día.',
    personas: 1,
    camas: 1,
    metros: null,
    comodidades: [],
    fotos: [],
    acento: '#2f6b52',
  },
  doble: {
    clave: 'doble',
    nombre: 'Habitación doble',
    resumen: 'Para compartir el viaje con un colega, un familiar o un acompañante.',
    personas: 2,
    camas: 2,
    metros: null,
    comodidades: [],
    fotos: [],
    acento: '#b07a22',
  },
  triple: {
    clave: 'triple',
    nombre: 'Habitación triple',
    resumen: 'Tres camas para familias pequeñas o equipos que viajan juntos.',
    personas: 3,
    camas: 3,
    metros: null,
    comodidades: [],
    fotos: [],
    acento: '#a2463a',
  },
  multiple: {
    clave: 'multiple',
    nombre: 'Habitación múltiple',
    resumen: 'Espacio para grupos: delegaciones, equipos de trabajo o familias grandes.',
    personas: 4,
    camas: 4,
    metros: null,
    comodidades: [],
    fotos: [],
    acento: '#3a6f8f',
  },
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Asocia un tipo publicado con la ficha (y la maqueta) que más se le parece
export function fichaPara(nombre: string, capacidad: number | null): FichaHabitacion {
  const n = sinTildes(nombre);
  if (n.includes('sencill') || n.includes('individual')) return FICHAS.sencilla;
  if (n.includes('tripl')) return FICHAS.triple;
  if (n.includes('multipl') || n.includes('grupo') || n.includes('familiar'))
    return FICHAS.multiple;
  if (n.includes('doble') || n.includes('pareja')) return FICHAS.doble;
  if (capacidad === 1) return FICHAS.sencilla;
  if (capacidad === 3) return FICHAS.triple;
  return capacidad && capacidad > 3 ? FICHAS.multiple : FICHAS.doble;
}

// Habitación que se muestra en la vitrina: un tipo publicado o una ficha de referencia
export interface HabitacionVitrina {
  clave: string; // única en la vitrina
  tipoId: string | null; // id del tipo publicado (para preseleccionarlo en la solicitud)
  nombre: string;
  descripcion: string;
  personas: number;
  ficha: FichaHabitacion;
  referencia: boolean;
}

export interface TipoPublicado {
  id: string;
  nombre: string;
  descripcion: string | null;
  capacidadSugerida: number | null;
}

export function armarVitrina(tipos: TipoPublicado[]): HabitacionVitrina[] {
  if (tipos.length === 0) {
    return Object.values(FICHAS).map((f) => ({
      clave: f.clave,
      tipoId: null,
      nombre: f.nombre,
      descripcion: f.resumen,
      personas: f.personas,
      ficha: f,
      referencia: true,
    }));
  }
  return tipos.map((t) => {
    const ficha = fichaPara(t.nombre, t.capacidadSugerida);
    return {
      clave: t.id,
      tipoId: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion ?? ficha.resumen,
      personas: t.capacidadSugerida ?? ficha.personas,
      ficha,
      referencia: false,
    };
  });
}

// Lleva al formulario con la habitación elegida (el tipo publicado o la ficha de referencia)
export function enlaceSolicitud(h: HabitacionVitrina): string {
  return h.tipoId ? `/solicitar?tipo=${h.tipoId}` : `/solicitar?habitacion=${h.ficha.clave}`;
}
