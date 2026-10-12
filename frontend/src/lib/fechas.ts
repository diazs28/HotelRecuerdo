// Fechas de calendario del hotel ("YYYY-MM-DD"). Se interpretan en America/Bogota.
// Una reserva ocupa las noches [entrada, salida): la salida no es noche.

export const ZONA_HOTEL = 'America/Bogota';
const MS_DIA = 86_400_000;

export function hoyEnHotel(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HOTEL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

const aUtc = (fecha: string) => new Date(`${fecha}T00:00:00Z`);

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtc(fecha).getTime() + dias * MS_DIA).toISOString().slice(0, 10);
}

export function noches(entrada: string, salida: string): number {
  return Math.round((aUtc(salida).getTime() - aUtc(entrada).getTime()) / MS_DIA);
}

// Días [desde, hasta)
export function diasEntre(desde: string, hasta: string): string[] {
  const n = Math.max(0, noches(desde, hasta));
  return Array.from({ length: n }, (_, i) => sumarDias(desde, i));
}

export function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function sumarMeses(fecha: string, meses: number): string {
  const [a, m] = fecha.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + meses, 1));
  return d.toISOString().slice(0, 10);
}

// Las fechas de calendario se formatean en UTC para que no "retrocedan" un día
const fmtCorta = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const fmtLarga = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const fmtMes = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});
const fmtDiaSemana = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'narrow' });
const fmtMomento = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HOTEL,
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const fechaCorta = (f: string) => fmtCorta.format(aUtc(f));
export const fechaLarga = (f: string) => fmtLarga.format(aUtc(f));
export const nombreMes = (f: string) => {
  const t = fmtMes.format(aUtc(f));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const inicialDia = (f: string) => fmtDiaSemana.format(aUtc(f));
export const diaDelMes = (f: string) => Number(f.slice(8, 10));
export const esFinDeSemana = (f: string) => [0, 6].includes(aUtc(f).getUTCDay());

// Momento exacto (ISO del servidor) en hora de Colombia
export function momento(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : fmtMomento.format(d);
}

export function rangoEstancia(entrada: string, salida: string): string {
  const n = noches(entrada, salida);
  return `${fechaCorta(entrada)} – ${fechaCorta(salida)} (${n} ${n === 1 ? 'noche' : 'noches'})`;
}
