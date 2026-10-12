import { useEffect, type RefObject } from 'react';

// Agrega .visible a cada [data-revelar] dentro de la raíz cuando entra en pantalla (una sola vez)
export function useRevelar(
  raiz: RefObject<HTMLElement | null>,
  dependencias: unknown[] = [],
): void {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const objetivos = el.querySelectorAll<HTMLElement>('[data-revelar]');
    if (!('IntersectionObserver' in window)) {
      objetivos.forEach((o) => o.classList.add('visible'));
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('visible');
          observador.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    objetivos.forEach((o) => observador.observe(o));
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);
}
