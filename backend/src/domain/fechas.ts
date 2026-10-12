// Fechas de calendario del hotel (sin hora). Se representan como texto ISO "YYYY-MM-DD" en la API
// y como DATE en PostgreSQL. Funciones puras: no dependen de la base de datos.
//
// Regla de negocio (docs/adr/0003): una reserva ocupa las NOCHES del rango [entrada, salida).
// La fecha de salida no se cuenta como noche, así la salida de un huésped puede ser la entrada de otro.

export const ZONA_HORARIA_HOTEL = 'America/Bogota';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 86_400_000;

// true si el texto es una fecha de calendario real (rechaza 2026-02-30)
export function esFechaValida(texto: string): boolean {
  if (!FECHA_REGEX.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

// "YYYY-MM-DD" -> Date a medianoche UTC (lo que Prisma espera para columnas @db.Date)
export function aFechaBd(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`);
}

// Date de una columna @db.Date -> "YYYY-MM-DD"
export function deFechaBd(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Fecha de hoy en la zona horaria del hotel (no la del servidor)
export function hoyEnHotel(ahora: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_HOTEL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function sumarDias(texto: string, dias: number): string {
  return deFechaBd(new Date(aFechaBd(texto).getTime() + dias * MS_POR_DIA));
}

// Noches entre dos fechas (salida - entrada)
export function noches(entrada: string, salida: string): number {
  return Math.round((aFechaBd(salida).getTime() - aFechaBd(entrada).getTime()) / MS_POR_DIA);
}

// ¿Los rangos de noches [a1, a2) y [b1, b2) tienen alguna noche en común? null = sin fin.
export function rangosSeCruzan(
  a1: string,
  a2: string | null,
  b1: string,
  b2: string | null,
): boolean {
  const aAntesDeFinB = b2 === null || a1 < b2;
  const bAntesDeFinA = a2 === null || b1 < a2;
  return aAntesDeFinB && bAntesDeFinA;
}

// ¿La noche "fecha" está dentro de [inicio, fin)?
export function incluyeNoche(inicio: string, fin: string | null, fecha: string): boolean {
  return inicio <= fecha && (fin === null || fecha < fin);
}

export type ErrorRangoFechas = 'SALIDA_NO_POSTERIOR' | 'ESTANCIA_DEMASIADO_LARGA';

export const ESTANCIA_MAXIMA_NOCHES = 365;

export function validarRangoEstancia(entrada: string, salida: string): ErrorRangoFechas | null {
  if (salida <= entrada) return 'SALIDA_NO_POSTERIOR';
  if (noches(entrada, salida) > ESTANCIA_MAXIMA_NOCHES) return 'ESTANCIA_DEMASIADO_LARGA';
  return null;
}
