import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cx } from '../../ui';
import { Icono } from '../Iconos';

export interface Diapositiva {
  src: string;
  alt: string;
  etiqueta: string;
}

const UMBRAL_SWIPE = 40;
const dos = (n: number) => String(n).padStart(2, '0');

// Carrusel de imágenes de una habitación (estilo de las tarjetas de hotel: flechas a los lados,
// contador y puntos). La imagen nueva entra con una cortina en la dirección del movimiento,
// sobre la anterior. Se mueve con las flechas, los puntos, el teclado (← →) o deslizando.
export function Carrusel({
  diapositivas,
  titulo,
  cargando = false,
  children,
  className,
}: {
  diapositivas: Diapositiva[];
  titulo: string;
  cargando?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const [estado, setEstado] = useState({ actual: 0, previo: -1, dir: 1 });
  const inicioToque = useRef<number | null>(null);
  const total = diapositivas.length;
  const actual = Math.min(estado.actual, Math.max(0, total - 1));

  const ir = (indice: number, dir: number) => {
    if (total < 2) return;
    const destino = ((indice % total) + total) % total;
    if (destino === actual) return;
    setEstado({ actual: destino, previo: actual, dir });
  };

  const teclado = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    ir(actual + dir, dir);
  };

  const presionar = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    inicioToque.current = e.clientX;
  };
  const soltar = (e: PointerEvent) => {
    const x0 = inicioToque.current;
    inicioToque.current = null;
    if (x0 === null) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) < UMBRAL_SWIPE) return;
    const dir = dx < 0 ? 1 : -1;
    ir(actual + dir, dir);
  };

  const diapositiva = diapositivas[actual];
  const previa = estado.previo >= 0 ? diapositivas[estado.previo] : undefined;

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label={titulo}
      onKeyDown={teclado}
      onPointerDown={presionar}
      onPointerUp={soltar}
      onPointerCancel={() => (inicioToque.current = null)}
      className={cx(
        'group/carrusel relative isolate touch-pan-y overflow-hidden bg-[radial-gradient(ellipse_at_50%_70%,#1c2a36,var(--color-noche)_75%)]',
        className,
      )}
    >
      <div aria-hidden className="rejilla absolute inset-0 opacity-60" />

      {cargando && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-niebla">
            <span className="size-10 animate-spin rounded-full border border-brasa/30 border-t-brasa" />
            <span className="etiqueta-hud">Construyendo la maqueta 3D…</span>
          </div>
        </div>
      )}

      {previa && (
        <img
          src={previa.src}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {diapositiva && (
        <img
          key={actual}
          src={diapositiva.src}
          alt={diapositiva.alt}
          draggable={false}
          onAnimationEnd={() => setEstado((s) => ({ ...s, previo: -1 }))}
          className={cx(
            'absolute inset-0 size-full object-cover',
            previa && (estado.dir > 0 ? 'cortina-derecha' : 'cortina-izquierda'),
          )}
        />
      )}

      {diapositiva && (
        <p className="etiqueta-hud vidrio absolute left-3 top-3 rounded-full px-3 py-1.5 text-[0.62rem] text-luz">
          {diapositiva.etiqueta}
        </p>
      )}

      {total > 1 && (
        <>
          <BotonFlecha dir={-1} onClick={() => ir(actual - 1, -1)} />
          <BotonFlecha dir={1} onClick={() => ir(actual + 1, 1)} />
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {diapositivas.map((d, i) => (
              <button
                key={d.src}
                type="button"
                onClick={() => ir(i, i > actual ? 1 : -1)}
                aria-label={`Ver imagen ${i + 1}: ${d.etiqueta}`}
                aria-current={i === actual ? 'true' : undefined}
                className="grid h-6 place-items-center px-0.5"
              >
                <span
                  className={cx(
                    'block h-1.5 rounded-full transition-all duration-500',
                    i === actual ? 'w-6 bg-brasa-2' : 'w-1.5 bg-luz/45 hover:bg-luz/80',
                  )}
                />
              </button>
            ))}
          </div>
          <p
            aria-hidden
            className="etiqueta-hud absolute bottom-4 left-4 hidden text-[0.62rem] text-luz/80 sm:block"
          >
            {dos(actual + 1)} / {dos(total)}
          </p>
        </>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {diapositiva ? `Imagen ${actual + 1} de ${total}: ${diapositiva.etiqueta}` : ''}
      </p>
      {children}
    </div>
  );
}

function BotonFlecha({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir > 0 ? 'Imagen siguiente' : 'Imagen anterior'}
      className={cx(
        'absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-noche/55 text-luz ring-1 ring-luz/20 backdrop-blur transition hover:scale-110 hover:bg-noche/80',
        dir > 0 ? 'right-3' : 'left-3',
      )}
    >
      <Icono nombre={dir > 0 ? 'derecha' : 'izquierda'} className="size-5" />
    </button>
  );
}
