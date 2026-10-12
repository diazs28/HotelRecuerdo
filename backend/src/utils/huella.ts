import { createHash } from 'node:crypto';

// JSON con las claves ordenadas: el mismo contenido produce siempre el mismo texto
function jsonEstable(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstable).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${jsonEstable(v)}`).join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

// Huella SHA-256 del contenido de una solicitud (para detectar una clave de idempotencia reutilizada
// con datos distintos)
export function huellaDe(valor: unknown): string {
  return createHash('sha256').update(jsonEstable(valor)).digest('hex');
}
