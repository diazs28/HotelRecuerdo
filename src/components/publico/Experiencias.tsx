import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { EXPERIENCIAS } from '../../config/experiencias';
import { FICHAS } from '../../config/habitaciones';
import { useRevelar } from '../../hooks/useRevelar';
import { irASeccion } from '../../hooks/useScrollSuave';
import { cx } from '../ui';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { Icono } from './Iconos';
import { PalabraGigante } from './PalabraGigante';

// "¿A qué vienes a Popayán?": un plan por motivo de viaje. Al cambiar de pestaña el ambiente
// cambia de color, la palabra gigante se reemplaza letra por letra y el contenido entra de nuevo.
export function Experiencias() {
  const raiz = useRef<HTMLElement>(null);
  const pestanas = useRef<Array<HTMLButtonElement | null>>([]);
  const [activa, setActiva] = useState(0);
  const e = EXPERIENCIAS[activa]!;
  useRevelar(raiz);

  const teclado = (ev: KeyboardEvent) => {
    const total = EXPERIENCIAS.length;
    const destinos: Record<string, number> = {
      ArrowRight: (activa + 1) % total,
      ArrowLeft: (activa - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    const destino = destinos[ev.key];
    if (destino === undefined) return;
    ev.preventDefault();
    setActiva(destino);
    pestanas.current[destino]?.focus();
  };

  return (
    <section
      ref={raiz}
      id="experiencias"
      aria-labelledby="titulo-experiencias"
      className="ambiente relative scroll-mt-20 overflow-hidden px-4 py-24 sm:px-6 md:py-32"
      style={{ '--c1': e.color, '--c2': e.color2 } as CSSProperties}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 top-10 size-[38rem] rounded-full bg-[var(--c2)] opacity-35 blur-[120px]" />
        <div className="absolute -left-40 bottom-0 size-[30rem] rounded-full bg-[var(--c1)] opacity-15 blur-[120px]" />
        <div className="orbe absolute right-[6%] top-[18%] hidden size-72 rounded-full lg:block" />
      </div>
      <PalabraGigante
        texto={e.palabra}
        className="pointer-events-none absolute inset-x-0 bottom-6 justify-items-center font-display text-[clamp(5rem,19vw,17rem)] leading-none text-[var(--c1)] opacity-[0.13]"
      />

      <div className="relative mx-auto max-w-6xl">
        <EncabezadoSeccion
          numero="03"
          etiqueta="Experiencias"
          id="titulo-experiencias"
          titulo="¿A qué vienes a Popayán?"
        >
          Elige el motivo de tu viaje: te contamos qué tener en cuenta y dejamos tu solicitud lista
          para que el equipo del hotel te responda mejor.
        </EncabezadoSeccion>

        <div
          role="tablist"
          aria-label="Motivo del viaje"
          onKeyDown={teclado}
          data-revelar
          className="revelar mt-12 flex flex-wrap gap-2"
        >
          {EXPERIENCIAS.map((x, i) => (
            <button
              key={x.clave}
              ref={(el) => {
                pestanas.current[i] = el;
              }}
              id={`pestana-${x.clave}`}
              role="tab"
              type="button"
              aria-selected={i === activa}
              aria-controls="panel-experiencia"
              tabIndex={i === activa ? 0 : -1}
              onClick={() => setActiva(i)}
              className={cx(
                'min-h-11 shrink-0 rounded-full px-5 font-semibold transition duration-300',
                i === activa
                  ? 'bg-luz text-noche shadow-[0_0_40px_-8px_var(--c1)]'
                  : 'text-luz ring-1 ring-luz/20 hover:bg-luz/10',
              )}
            >
              {x.pestana}
            </button>
          ))}
        </div>

        <div
          key={e.clave}
          id="panel-experiencia"
          role="tabpanel"
          aria-labelledby={`pestana-${e.clave}`}
          className="panel-entra mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]"
        >
          <div>
            <h3 className="text-3xl sm:text-5xl">{e.titulo}</h3>
            <p className="mt-5 max-w-xl text-lg text-luz/85">{e.texto}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={`/solicitar?motivo=${e.clave}`}
                viewTransition
                className="boton-brasa inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold"
              >
                Solicitar con este plan
                <Icono nombre="flechaDerecha" className="size-4" />
              </Link>
              <a
                href="#habitaciones"
                onClick={(ev) => irASeccion('habitaciones') && ev.preventDefault()}
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-semibold ring-1 ring-luz/25 transition hover:bg-luz/10"
              >
                Sugerida: {FICHAS[e.sugerida].nombre.toLowerCase()}
              </a>
            </div>
          </div>
          <div className="vidrio rounded-3xl p-6 sm:p-8">
            <p className="etiqueta-hud text-[var(--c1)]">Cuéntanos en tu solicitud</p>
            <ul className="mt-5 flex flex-col gap-4">
              {e.preguntas.map((p, i) => (
                <li
                  key={p}
                  className="panel-entra flex items-start gap-3"
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--c1)] text-noche">
                    <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                      <path
                        d="M2.5 6.2 5 8.5l4.5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </span>
                  <span className="text-luz/90">{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-luz/10 pt-4 text-sm text-niebla">
              Al elegir este plan, tu solicitud llega con el motivo del viaje escrito.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
