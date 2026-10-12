import { useSyncExternalStore } from 'react';

// Estado compartido "la pantalla de entrada terminó": la portada espera esta señal para animar
// su título. Si la entrada no se muestra, se considera terminada desde el principio.
let terminada = true;
const oyentes = new Set<() => void>();

export function marcarIntroEnCurso(): void {
  terminada = false;
}

export function avisarFinIntro(): void {
  terminada = true;
  oyentes.forEach((o) => o());
}

export function useIntroTerminada(): boolean {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => terminada,
  );
}
