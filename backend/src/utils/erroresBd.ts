// Reconocimiento de errores de PostgreSQL que llegan envueltos por Prisma (adaptador pg).
// Se busca el SQLSTATE o el nombre de la restricción en el error y en su causa, sin depender de
// la forma exacta del envoltorio (cambia entre versiones de Prisma).

const EXCLUSION = '23P01';
const RESTRICCION_OCUPACIONES = 'ocupaciones_cama_sin_cruce';

function textoDelError(err: unknown, profundidad = 0): string {
  if (!err || typeof err !== 'object' || profundidad > 4) return '';
  const e = err as Record<string, unknown>;
  const partes: string[] = [];
  for (const clave of ['code', 'originalCode', 'constraint', 'message', 'kind']) {
    const v = e[clave];
    if (typeof v === 'string') partes.push(v);
  }
  if (e.meta) {
    try {
      partes.push(JSON.stringify(e.meta));
    } catch {
      // meta no serializable: se ignora
    }
  }
  partes.push(textoDelError(e.cause, profundidad + 1));
  return partes.join(' ');
}

// true si el error es la violación de la restricción que impide ocupaciones cruzadas de una cama
export function esViolacionExclusion(err: unknown): boolean {
  const texto = textoDelError(err);
  return texto.includes(RESTRICCION_OCUPACIONES) || texto.includes(EXCLUSION);
}

// Deadlock (40P01) o fallo de serialización (40001): la operación se puede reintentar
export function esConflictoTransitorio(err: unknown): boolean {
  const texto = textoDelError(err);
  return ['40P01', '40001', 'deadlock detected'].some((c) => texto.includes(c));
}

// Violación de un índice único (P2002). Si se indica, solo cuando involucra ese campo o índice.
export function esUnicoRepetido(err: unknown, indice?: string): boolean {
  if (!err || typeof err !== 'object' || (err as { code?: unknown }).code !== 'P2002') return false;
  if (!indice) return true;
  return JSON.stringify((err as { meta?: unknown }).meta ?? {}).includes(indice);
}
