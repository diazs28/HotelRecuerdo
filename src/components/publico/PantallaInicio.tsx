import { useRef, useState } from 'react';
import { MARCA } from '../../config/marca';
import { gsap, useGSAP } from '../../lib/gsap';
import { movimientoReducido } from '../../hooks/useMovimientoReducido';
import { avisarFinIntro, marcarIntroEnCurso } from '../../lib/intro';

const CLAVE = 'recuerdo:intro';
const ARCOS = 7;

function yaVista(): boolean {
  try {
    return sessionStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

function marcarVista() {
  try {
    sessionStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento (modo privado estricto): se volverá a mostrar, no pasa nada
  }
}

const debeMostrarse = () =>
  !movimientoReducido() &&
  window.location.pathname === '/' &&
  // Con un enlace a una sección (/#habitaciones) se va directo a ella, sin entrada
  !window.location.hash &&
  !yaVista();

// Pantalla de entrada (adaptada de la de Portal Salud): el contador viaja de 1979 al año actual,
// "El Recuerdo" emerge letra por letra y una arcada de arcos blancos sube para descubrir el sitio.
// Una vez por pestaña; nunca con movimiento reducido ni al entrar por otra página.
export function PantallaInicio({ anioActual }: { anioActual: number }) {
  const raiz = useRef<HTMLDivElement>(null);
  const contador = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(() => {
    const mostrar = debeMostrarse();
    if (mostrar) marcarIntroEnCurso();
    return mostrar;
  });

  useGSAP(
    () => {
      if (!visible || !raiz.current) return;
      marcarVista();
      window.scrollTo(0, 0);
      const overflowPrevio = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      const anio = { valor: MARCA.anioOrigen };

      const fin = () => {
        document.documentElement.style.overflow = overflowPrevio;
        avisarFinIntro();
        setVisible(false);
      };

      gsap
        .timeline({ onComplete: fin })
        .from('[data-letra]', {
          yPercent: 110,
          duration: 0.7,
          stagger: 0.045,
          ease: 'expo.out',
        })
        .from('[data-linea]', { scaleX: 0, duration: 1.1, ease: 'expo.inOut' }, 0.1)
        .to(
          anio,
          {
            valor: anioActual,
            duration: 1.3,
            ease: 'power2.inOut',
            onUpdate: () => {
              if (contador.current) contador.current.textContent = String(Math.round(anio.valor));
            },
          },
          0.15,
        )
        .fromTo(
          '[data-arco]',
          { yPercent: 100 },
          {
            yPercent: 0,
            duration: 0.6,
            stagger: { each: 0.06, from: 'center' },
            ease: 'power3.in',
          },
          '+=0.25',
        )
        .set('[data-texto]', { autoAlpha: 0 })
        .set(raiz.current, { backgroundColor: 'transparent' })
        .to('[data-arco]', {
          yPercent: -100,
          duration: 0.75,
          stagger: { each: 0.06, from: 'center' },
          ease: 'power3.inOut',
        });

      // Respaldo si la pestaña pasa a segundo plano y la animación no termina
      const respaldo = window.setTimeout(fin, 6000);
      return () => {
        window.clearTimeout(respaldo);
        document.documentElement.style.overflow = overflowPrevio;
      };
    },
    { scope: raiz, dependencies: [visible] },
  );

  if (!visible) return null;

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-noche"
    >
      <div data-texto className="flex flex-col items-center gap-5 px-6 text-center">
        <span ref={contador} className="font-mono text-sm tracking-[0.4em] text-brasa-2">
          {MARCA.anioOrigen}
        </span>
        <p className="flex overflow-hidden font-display text-5xl text-luz sm:text-7xl">
          {[...'El Recuerdo'].map((l, i) => (
            <span key={i} data-letra className="inline-block">
              {l === ' ' ? ' ' : l}
            </span>
          ))}
        </p>
        <span data-linea className="block h-px w-48 origin-left bg-brasa/70" />
        <span className="etiqueta-hud text-niebla">
          {MARCA.ciudad} · {MARCA.departamento}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 flex">
        {Array.from({ length: ARCOS }).map((_, i) => (
          <div
            key={i}
            data-arco
            className="-ml-px h-full flex-1 translate-y-full rounded-t-full bg-luz"
          />
        ))}
      </div>
    </div>
  );
}
