import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import type { DatosPublicos } from '../../api/tipos';
import { MARCA } from '../../config/marca';
import { useMovimientoReducido } from '../../hooks/useMovimientoReducido';
import { useRevelar } from '../../hooks/useRevelar';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { Icono } from './Iconos';

interface Brasa {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vida: number;
}

// Brasas del horno en un canvas 2D: suben, titilan y se apartan del puntero
function useBrasas(lienzo: RefObject<HTMLCanvasElement | null>, activo: boolean) {
  const puntero = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const c = lienzo.current;
    const g = c?.getContext('2d');
    if (!c || !g || !activo) return;
    let ancho = 0;
    let alto = 0;
    const escala = Math.min(window.devicePixelRatio, 2);
    const ajustar = () => {
      ancho = c.clientWidth;
      alto = c.clientHeight;
      c.width = ancho * escala;
      c.height = alto * escala;
      g.setTransform(escala, 0, 0, escala, 0, 0);
    };
    ajustar();
    const total = ancho < 640 ? 45 : 110;
    const nueva = (inicio: boolean): Brasa => ({
      x: Math.random() * ancho,
      y: inicio ? Math.random() * alto : alto + 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.3 + Math.random() * 0.9),
      r: 0.8 + Math.random() * 2.2,
      vida: Math.random() * Math.PI * 2,
    });
    const brasas = Array.from({ length: total }, () => nueva(true));

    let cuadro = 0;
    let visible = false;
    const dibujar = () => {
      g.clearRect(0, 0, ancho, alto);
      g.globalCompositeOperation = 'lighter';
      const { x: px, y: py } = puntero.current;
      for (const b of brasas) {
        const dx = b.x - px;
        const dy = b.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          const f = (1 - d2 / 14000) * 0.6;
          b.vx += (dx / Math.sqrt(d2 + 1)) * f;
          b.vy += (dy / Math.sqrt(d2 + 1)) * f * 0.5;
        }
        b.vx *= 0.96;
        b.x += b.vx + Math.sin(b.vida) * 0.25;
        b.y += b.vy;
        b.vida += 0.05;
        if (b.y < -10 || b.x < -20 || b.x > ancho + 20) Object.assign(b, nueva(false));
        const brillo = 0.45 + Math.sin(b.vida * 2) * 0.3;
        const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 4);
        grad.addColorStop(0, `rgba(255, 200, 120, ${brillo})`);
        grad.addColorStop(0.4, `rgba(240, 130, 50, ${brillo * 0.5})`);
        grad.addColorStop(1, 'rgba(240, 100, 30, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(b.x, b.y, b.r * 4, 0, Math.PI * 2);
        g.fill();
      }
      if (visible) cuadro = requestAnimationFrame(dibujar);
    };
    const observador = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      cancelAnimationFrame(cuadro);
      if (visible) cuadro = requestAnimationFrame(dibujar);
    });
    observador.observe(c);
    const tam = new ResizeObserver(ajustar);
    tam.observe(c);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      tam.disconnect();
    };
  }, [lienzo, activo]);

  return puntero;
}

export function Restaurante({ datos }: { datos: DatosPublicos | undefined }) {
  const raiz = useRef<HTMLElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const linterna = useRef<HTMLDivElement>(null);
  const reducido = useMovimientoReducido();
  const puntero = useBrasas(lienzo, !reducido);
  const restaurante = datos?.ajustes.restaurante;
  useRevelar(raiz);

  const mover = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    puntero.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    const l = linterna.current;
    if (!l) return;
    const rl = l.getBoundingClientRect();
    l.style.setProperty('--x', `${e.clientX - rl.left}px`);
    l.style.setProperty('--y', `${e.clientY - rl.top}px`);
    l.dataset.siguiendo = 'si';
  };

  return (
    <section
      ref={raiz}
      id="restaurante"
      aria-labelledby="titulo-restaurante"
      onPointerMove={mover}
      onPointerLeave={() => (puntero.current = { x: -9999, y: -9999 })}
      className="relative scroll-mt-20 overflow-hidden bg-[radial-gradient(ellipse_at_50%_120%,rgb(240_120_40/0.35),transparent_60%)] px-4 py-24 sm:px-6 md:py-32"
    >
      <canvas ref={lienzo} aria-hidden className="pointer-events-none absolute inset-0 size-full" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <EncabezadoSeccion
            numero="04"
            etiqueta="Restaurante y pizzería"
            id="titulo-restaurante"
            titulo="Donde empezó todo"
          >
            {restaurante?.descripcion ??
              `El Recuerdo nació como pizzería en ${MARCA.anioOrigen}. Hoy, además del alojamiento, la casa ofrece restaurante y pizzería.`}
          </EncabezadoSeccion>
          <ul data-revelar className="revelar mt-8 flex flex-wrap gap-3">
            <li className="vidrio flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <Icono nombre="horno" className="size-5 text-brasa-2" />
              Pizzería desde {MARCA.anioOrigen}
            </li>
            <li className="vidrio flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <Icono nombre="plato" className="size-5 text-brasa-2" />
              Restaurante en la misma casa
            </li>
            {restaurante?.horario && (
              <li className="vidrio flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <Icono nombre="reloj" className="size-5 text-brasa-2" />
                {restaurante.horario}
              </li>
            )}
          </ul>
        </div>

        {/* "1979" a contorno; la linterna que sigue al puntero lo revela encendido */}
        <div
          ref={linterna}
          aria-hidden
          className="linterna relative select-none text-center font-display text-[clamp(6rem,24vw,17rem)] leading-none"
        >
          <span className="texto-contorno block">{MARCA.anioOrigen}</span>
          <span className="linterna-luz absolute inset-0 block bg-linear-to-b from-brasa-2 via-brasa to-[#c2410c] bg-clip-text text-transparent">
            {MARCA.anioOrigen}
          </span>
        </div>
      </div>
    </section>
  );
}
