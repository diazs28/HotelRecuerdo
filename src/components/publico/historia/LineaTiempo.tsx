import { useRef, useState } from 'react';
import { LINEA_TIEMPO } from '../../../config/historia';
import { useConsulta, useMovimientoReducido } from '../../../hooks/useMovimientoReducido';
import { useRevelar } from '../../../hooks/useRevelar';
import { desplazarA } from '../../../hooks/useScrollSuave';
import { ScrollTrigger, useGSAP } from '../../../lib/gsap';
import { cx } from '../../ui';
import { EncabezadoSeccion } from '../EncabezadoSeccion';
import { PalabraGigante } from '../PalabraGigante';
import { TarjetaCapitulo } from './TarjetaCapitulo';

const PROFUNDIDAD = 1100; // px entre capítulos en el corredor
const n = LINEA_TIEMPO.length;

function Corredor({ anios }: { anios: number }) {
  const seccion = useRef<HTMLElement>(null);
  const fijo = useRef<HTMLDivElement>(null);
  const mundo = useRef<HTMLDivElement>(null);
  const tarjetas = useRef<Array<HTMLDivElement | null>>([]);
  const barra = useRef<HTMLSpanElement>(null);
  const disparador = useRef<ScrollTrigger | null>(null);
  const [activo, setActivo] = useState(0);
  const activoRef = useRef(0);

  useGSAP(
    () => {
      if (!seccion.current || !fijo.current) return;
      const pintar = (progreso: number) => {
        const pos = progreso * (n - 1);
        if (mundo.current) mundo.current.style.transform = `translateZ(${pos * PROFUNDIDAD}px)`;
        tarjetas.current.forEach((el, i) => {
          if (!el) return;
          const d = i - pos;
          const opacidad = d < 0 ? Math.max(0, 1 + d * 3.2) : Math.max(0.06, 1 - d * 0.5);
          el.style.opacity = String(opacidad);
          el.style.pointerEvents = Math.abs(d) < 0.35 ? 'auto' : 'none';
          el.style.visibility = opacidad < 0.02 ? 'hidden' : 'visible';
        });
        if (barra.current) barra.current.style.transform = `scaleX(${progreso})`;
        const indice = Math.round(pos);
        if (indice !== activoRef.current) {
          activoRef.current = indice;
          setActivo(indice);
        }
      };
      disparador.current = ScrollTrigger.create({
        trigger: seccion.current,
        pin: fijo.current,
        start: 'top top',
        end: () => `+=${(n - 1) * window.innerHeight * 0.85}`,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => pintar(self.progress),
      });
      pintar(0);
    },
    { scope: seccion },
  );

  const ir = (i: number) => {
    const st = disparador.current;
    if (!st) return;
    desplazarA(st.start + (i / (n - 1)) * (st.end - st.start) + 2);
  };

  const capitulo = LINEA_TIEMPO[activo]!;

  return (
    <section ref={seccion} id="historia" aria-labelledby="titulo-historia" className="relative">
      <div ref={fijo} className="relative h-svh overflow-hidden">
        <div
          aria-hidden
          className="rejilla absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <PalabraGigante
          texto={capitulo.marca}
          className="texto-contorno pointer-events-none absolute inset-x-0 top-1/2 opacity-60 -translate-y-1/2 justify-items-center font-display text-[clamp(10rem,30vw,26rem)] leading-none"
        />

        <header className="absolute left-4 right-4 top-20 z-10 sm:left-8 sm:top-24">
          <p className="etiqueta-hud flex items-center gap-3 text-brasa-2">
            <span>01</span>
            <span aria-hidden className="h-px w-10 bg-brasa-2/60" />
            <span>Historia</span>
          </p>
          <h2 id="titulo-historia" className="mt-3 text-3xl lg:text-4xl">
            {anios} años de memoria
          </h2>
          <p className="etiqueta-hud mt-2 text-niebla">Desliza para viajar en el tiempo</p>
        </header>

        {/* Corredor de arcos: la cámara avanza por él a medida que se desplaza la página */}
        <div className="absolute inset-0 [perspective:1000px]">
          <div ref={mundo} className="absolute inset-0 [transform-style:preserve-3d]">
            {Array.from({ length: n * 2 }).map((_, k) => (
              <svg
                key={k}
                aria-hidden
                viewBox="0 0 100 140"
                preserveAspectRatio="none"
                className="absolute left-1/2 top-1/2 h-[130vh] w-[120vw] max-w-[1500px]"
                style={{
                  transform: `translate(-50%, -50%) translateZ(${-k * (PROFUNDIDAD / 2) - 300}px)`,
                }}
                fill="none"
                stroke="rgb(243 239 228 / 0.14)"
                strokeWidth="0.25"
                vectorEffect="non-scaling-stroke"
              >
                <path d="M2 140V50a48 48 0 0 1 96 0v90" vectorEffect="non-scaling-stroke" />
              </svg>
            ))}
            {LINEA_TIEMPO.map((c, i) => (
              <div
                key={c.id}
                ref={(el) => {
                  tarjetas.current[i] = el;
                }}
                className="absolute left-1/2 top-1/2 w-[min(86vw,440px)]"
                style={{
                  transform: `translate(-50%, -42%) translate3d(${i % 2 ? 22 : -22}vw, 0, ${-i * PROFUNDIDAD}px)`,
                }}
                aria-hidden={i !== activo}
              >
                <TarjetaCapitulo capitulo={c} activo={i === activo} />
              </div>
            ))}
          </div>
        </div>

        {/* Riel del tiempo */}
        <nav
          aria-label="Épocas de la historia"
          className="absolute inset-x-4 bottom-6 z-10 sm:inset-x-8"
        >
          <div className="relative mx-auto max-w-4xl">
            <span aria-hidden className="absolute inset-x-0 top-[7px] h-px bg-luz/15" />
            <span
              ref={barra}
              aria-hidden
              className="absolute inset-x-0 top-[7px] h-px origin-left bg-brasa-2"
            />
            <ol className="relative flex justify-between">
              {LINEA_TIEMPO.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => ir(i)}
                    aria-current={i === activo ? 'step' : undefined}
                    className="group flex flex-col items-center gap-2"
                  >
                    <span
                      className={cx(
                        'size-[15px] rounded-full border-2 transition',
                        i <= activo ? 'border-brasa-2 bg-brasa-2' : 'border-luz/40 bg-noche',
                      )}
                    />
                    <span
                      className={cx(
                        'etiqueta-hud text-[0.62rem] transition',
                        i === activo ? 'text-luz' : 'text-niebla group-hover:text-luz',
                      )}
                    >
                      {c.marca}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </section>
  );
}

// Versión en lista (pantallas pequeñas y movimiento reducido)
function Lista({ anios }: { anios: number }) {
  const raiz = useRef<HTMLElement>(null);
  useRevelar(raiz);
  return (
    <section
      ref={raiz}
      id="historia"
      aria-labelledby="titulo-historia"
      className="relative scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <EncabezadoSeccion
          numero="01"
          etiqueta="Historia"
          id="titulo-historia"
          titulo={`${anios} años de memoria`}
        >
          Una casa familiar que empezó con un horno de pizza y creció junto a la Ciudad Blanca.
        </EncabezadoSeccion>
        <ol className="relative mt-14 flex flex-col gap-10 border-l border-luz/15 pl-6">
          {LINEA_TIEMPO.map((c) => (
            <li key={c.id} data-revelar className="revelar relative">
              <span
                aria-hidden
                className="absolute -left-[31px] top-3 size-3 rounded-full bg-brasa-2 ring-4 ring-noche"
              />
              <TarjetaCapitulo capitulo={c} activo />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LineaTiempo({ anios }: { anios: number }) {
  const reducido = useMovimientoReducido();
  const ancha = useConsulta('(min-width: 768px) and (min-height: 560px)');
  return !reducido && ancha ? <Corredor anios={anios} /> : <Lista anios={anios} />;
}
