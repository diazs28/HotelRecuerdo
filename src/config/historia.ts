// Línea de tiempo de la historia ("máquina del tiempo" del inicio).
//
// "casa": hechos de El Recuerdo según la caracterización (config/marca.ts).
// "ciudad": hitos públicos de Popayán que acompañan la historia. No son hechos del hotel y el
// sitio los presenta como tales ("En Popayán").
// TODO cliente: la familia puede agregar aquí sus propios hitos (apertura del hotel, ampliaciones…).

import { MARCA } from './marca';

export type IconoCapitulo = 'horno' | 'fachada' | 'plato' | 'vela' | 'llave' | 'pluma';

export interface Capitulo {
  id: string;
  marca: string; // lo que se ve en el riel: año, "Hoy" o "Tú"
  ambito: 'casa' | 'ciudad' | 'visitante';
  titulo: string;
  texto: string;
  icono: IconoCapitulo;
}

export const LINEA_TIEMPO: Capitulo[] = [
  {
    id: 'origen',
    marca: String(MARCA.anioOrigen),
    ambito: 'casa',
    titulo: 'Una pizzería familiar',
    texto: MARCA.historia.origen,
    icono: 'horno',
  },
  {
    id: 'reconstruccion',
    marca: '1983',
    ambito: 'ciudad',
    titulo: 'La ciudad se levanta',
    texto:
      'El 31 de marzo de 1983, Jueves Santo, un terremoto golpeó el centro histórico de Popayán. La ciudad reconstruyó sus casas blancas sin perder su carácter.',
    icono: 'fachada',
  },
  {
    id: 'gastronomia',
    marca: '2005',
    ambito: 'ciudad',
    titulo: 'Ciudad de la Gastronomía',
    texto:
      'La UNESCO nombró a Popayán su primera Ciudad Creativa de la Gastronomía, por una cocina que se hereda de generación en generación.',
    icono: 'plato',
  },
  {
    id: 'semana-santa',
    marca: '2009',
    ambito: 'ciudad',
    titulo: 'Patrimonio de la humanidad',
    texto:
      'Las procesiones de Semana Santa de Popayán entraron a la Lista Representativa del Patrimonio Cultural Inmaterial de la Humanidad.',
    icono: 'vela',
  },
  {
    id: 'hoy',
    marca: 'Hoy',
    ambito: 'casa',
    titulo: 'Mesa y descanso',
    texto: MARCA.historia.hoy,
    icono: 'llave',
  },
  {
    id: 'tu-capitulo',
    marca: 'Tú',
    ambito: 'visitante',
    titulo: 'El próximo capítulo',
    texto:
      'La siguiente página de El Recuerdo se escribe con quienes llegan. Cuéntanos cuándo vienes y te guardamos un lugar en la historia.',
    icono: 'pluma',
  },
];

export const NOMBRE_AMBITO: Record<Capitulo['ambito'], string> = {
  casa: 'En la casa',
  ciudad: 'En Popayán',
  visitante: 'Contigo',
};
