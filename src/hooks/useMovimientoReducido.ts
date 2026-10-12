import { useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

export const movimientoReducido = () => window.matchMedia(CONSULTA).matches;

// true si la persona pidió reducir las animaciones en su sistema operativo o navegador
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, movimientoReducido);
}

// true en pantallas medianas o más grandes (las escenas fijadas solo se usan ahí)
export function useConsulta(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consulta).matches,
  );
}
