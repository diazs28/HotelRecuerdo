import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger } from '../lib/gsap';

// Instancia activa: mientras existe, Lenis controla el scroll y un window.scrollTo directo no lo
// mueve, así que hay que pedírselo a él
let lenisActivo: Lenis | null = null;

const ALTO_ENCABEZADO = 72;

// Lleva la vista a una posición o a un elemento, con o sin Lenis activo
export function desplazarA(destino: number | HTMLElement, suave = true): void {
  if (lenisActivo) {
    lenisActivo.scrollTo(destino, {
      immediate: !suave,
      offset: typeof destino === 'number' ? 0 : -ALTO_ENCABEZADO,
      duration: 1.4,
    });
    return;
  }
  const top =
    typeof destino === 'number'
      ? destino
      : destino.getBoundingClientRect().top + window.scrollY - ALTO_ENCABEZADO;
  window.scrollTo({ top, behavior: suave ? 'smooth' : 'auto' });
}

// Va a una sección del inicio por su id (#historia, #habitaciones…)
export function irASeccion(id: string, suave = true): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  desplazarA(el, suave);
  return true;
}

// Desplazamiento suave (Lenis) sincronizado con ScrollTrigger mientras el sitio está montado.
// Se desactiva con movimiento reducido: el scroll nativo es más accesible.
export function useScrollSuave(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;
    const lenis = new Lenis({ lerp: 0.1 });
    lenisActivo = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (tiempo: number) => lenis.raf(tiempo * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      if (lenisActivo === lenis) lenisActivo = null;
    };
  }, [activo]);
}

// Detiene o reanuda el scroll (por ejemplo, mientras hay un diálogo abierto)
export function pausarScroll(pausar: boolean): void {
  if (lenisActivo) {
    if (pausar) lenisActivo.stop();
    else lenisActivo.start();
  }
  document.documentElement.style.overflow = pausar ? 'hidden' : '';
}
