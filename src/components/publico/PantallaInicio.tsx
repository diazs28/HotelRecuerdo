import { useEffect, useRef, useState } from 'react';
import { CREDITO_DESARROLLO, MARCA } from '../../config/marca';
import { movimientoReducido } from '../../hooks/useMovimientoReducido';
import { avisarFinIntro, marcarIntroEnCurso } from '../../lib/intro';

const CLAVE = 'recuerdo:intro';
// Tiempos de la animación (deben coincidir con la sección "Pantalla de entrada" de index.css)
const INICIO_CONTADOR_MS = 250;
const DURACION_CONTADOR_MS = 1350;
const SALIDA_MS = 2850; // el velo empieza a difuminarse y el título de la portada sube
const FIN_MS = 3750;

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

const suavizar = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Pantalla de entrada con el sello de BWL & SOFT (adaptada de la "ola difuminada" de su sitio):
// el año viaja de 1979 al actual, "El Recuerdo" se enfoca desde un desenfoque y se disuelve, sube
// una ola de brasa de borde suave con un brillo por delante y todo el velo sale desenfocándose
// mientras el título de la portada emerge. Dura unos 3,7 s, una vez por pestaña; nunca con
// movimiento reducido ni al entrar por otra página. La animación vive en index.css.
export function PantallaInicio({ anioActual }: { anioActual: number }) {
  const contador = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(() => {
    const mostrar = debeMostrarse();
    if (mostrar) marcarIntroEnCurso();
    return mostrar;
  });

  useEffect(() => {
    if (!visible) return;
    marcarVista();
    window.scrollTo(0, 0);
    const overflowPrevio = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    // Contador del año
    const inicio = performance.now() + INICIO_CONTADOR_MS;
    let cuadro = 0;
    const contar = (t: number) => {
      const avance = Math.min(1, Math.max(0, (t - inicio) / DURACION_CONTADOR_MS));
      const anio = Math.round(
        MARCA.anioOrigen + (anioActual - MARCA.anioOrigen) * suavizar(avance),
      );
      if (contador.current) contador.current.textContent = String(anio);
      if (avance < 1) cuadro = requestAnimationFrame(contar);
    };
    cuadro = requestAnimationFrame(contar);

    const salida = window.setTimeout(() => {
      document.documentElement.style.overflow = overflowPrevio;
      avisarFinIntro();
    }, SALIDA_MS);
    const fin = window.setTimeout(() => setVisible(false), FIN_MS);
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearTimeout(salida);
      window.clearTimeout(fin);
      document.documentElement.style.overflow = overflowPrevio;
    };
  }, [visible, anioActual]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="entrada fixed inset-0 z-[70] grid place-items-center overflow-hidden"
    >
      <div className="entrada__fondo absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        <span ref={contador} className="entrada__contador font-mono text-sm text-brasa-2">
          {MARCA.anioOrigen}
        </span>
        <p className="entrada__nombre font-display text-[clamp(2.8rem,10vw,6.5rem)] leading-none">
          El Recuerdo
        </p>
        <span className="entrada__linea block h-px w-44 bg-linear-to-r from-transparent via-brasa-2 to-transparent" />
        <span className="entrada__lema etiqueta-hud text-niebla">
          Hotel · Restaurante · Pizzería · {MARCA.ciudad}
        </span>
      </div>

      {/* Ola de brasa: un brillo difuminado va por delante y la ola cubre la pantalla */}
      <div className="entrada__brillo absolute inset-0" />
      <div className="entrada__ola absolute inset-0" />

      <p className="entrada__sello etiqueta-hud absolute inset-x-0 bottom-6 z-10 text-center text-[0.6rem] text-niebla">
        {CREDITO_DESARROLLO}
      </p>
    </div>
  );
}
