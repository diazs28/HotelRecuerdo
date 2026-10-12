import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { COORDENADAS_CIUDAD, MARCA } from '../../../config/marca';
import { useMovimientoReducido } from '../../../hooks/useMovimientoReducido';
import { irASeccion } from '../../../hooks/useScrollSuave';
import { gsap, ScrollTrigger, useGSAP } from '../../../lib/gsap';
import { ZONA_HOTEL } from '../../../lib/fechas';
import { useIntroTerminada } from '../../../lib/intro';
import { webglDisponible } from '../../../lib/webgl';
import { cx } from '../../ui';
import { Fachada } from '../Fachada';
import { Icono } from '../Iconos';
import type { Portada as EscenaPortada } from './escenaPortada';

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HOTEL,
  hour: '2-digit',
  minute: '2-digit',
});

function useHoraPopayan(): string {
  const [hora, setHora] = useState(() => formatoHora.format(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setHora(formatoHora.format(new Date())), 10_000);
    return () => window.clearInterval(t);
  }, []);
  return hora;
}

const TITULO = 'El Recuerdo';

// Portada: la calle de la Ciudad Blanca en 3D detrás del nombre. La sección mide más que la
// pantalla: mientras se desplaza, el contenido queda fijo y la cámara entra por el portón.
export function Portada() {
  const seccion = useRef<HTMLElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const destello = useRef<HTMLDivElement>(null);
  const escena = useRef<EscenaPortada | null>(null);
  const [con3d] = useState(webglDisponible);
  const reducido = useMovimientoReducido();
  const introTerminada = useIntroTerminada();
  const hora = useHoraPopayan();

  // La escena 3D se carga aparte (three.js) y se pausa cuando la portada no se ve
  useEffect(() => {
    if (!con3d || !lienzo.current) return;
    let cancelado = false;
    let observador: IntersectionObserver | null = null;
    import('./escenaPortada')
      .then(({ crearPortada }) => {
        if (cancelado || !lienzo.current) return;
        const e = crearPortada(lienzo.current, { reducido });
        escena.current = e;
        observador = new IntersectionObserver(([x]) => e.pausar(!x?.isIntersecting));
        if (seccion.current) observador.observe(seccion.current);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
      observador?.disconnect();
      escena.current?.liberar();
      escena.current = null;
    };
  }, [con3d, reducido]);

  useGSAP(
    () => {
      if (!seccion.current) return;
      const st = ScrollTrigger.create({
        trigger: seccion.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => escena.current?.establecerAvance(self.progress),
      });
      if (reducido) return () => st.kill();
      gsap
        .timeline({
          scrollTrigger: {
            trigger: seccion.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true,
          },
        })
        .to(contenido.current, { opacity: 0, y: -80, filter: 'blur(8px)', duration: 0.45 }, 0)
        .fromTo(destello.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.7);
      return () => st.kill();
    },
    { scope: seccion, dependencies: [reducido] },
  );

  return (
    <section
      ref={seccion}
      id="inicio"
      aria-labelledby="titulo-portada"
      className={cx('relative', reducido ? 'h-svh' : 'h-[190svh]')}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,#16263a,transparent_70%),radial-gradient(ellipse_60%_40%_at_20%_90%,rgb(240_160_75/0.12),transparent_70%)]"
        />
        {con3d ? (
          <canvas ref={lienzo} aria-hidden className="absolute inset-0 size-full" />
        ) : (
          <Fachada className="absolute bottom-0 right-0 w-[min(90vw,560px)] text-luz/70" />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-noche/85 via-noche/30 to-transparent md:via-noche/10"
        />
        <div
          ref={destello}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgb(255_196_119/0.55),var(--color-noche)_70%)] opacity-0"
        />

        {/* HUD: solo cuando hay espacio de sobra (no en celulares ni pantallas bajas) */}
        <div className="etiqueta-hud pointer-events-none absolute inset-x-0 top-24 hidden justify-between px-8 text-[0.62rem] text-niebla md:flex bajo:hidden">
          <p className="flex flex-col gap-1">
            <span className="text-luz">
              {MARCA.ciudad} · {MARCA.departamento}
            </span>
            <span>
              {COORDENADAS_CIUDAD.latitud} · {COORDENADAS_CIUDAD.longitud}
            </span>
          </p>
          <p className="flex flex-col items-end gap-1">
            <span>
              Hora en {MARCA.ciudad} <span className="text-luz">{hora}</span>
            </span>
            <span>Desde {MARCA.anioOrigen}</span>
          </p>
        </div>

        {/* El contenido se acomoda al alto disponible: en pantallas bajas todo se compacta */}
        <div
          ref={contenido}
          className="relative flex h-full flex-col justify-end px-4 pb-[max(4rem,9svh)] pt-20 sm:px-8 md:justify-center md:pb-0 bajo:justify-end bajo:pb-6 bajo:pt-18"
        >
          <div className="mx-auto w-full max-w-6xl">
            <p className="etiqueta-hud text-brasa-2">Hotel · Restaurante · Pizzería</p>
            <h1
              id="titulo-portada"
              className="mt-4 text-[clamp(2.6rem,min(14vw,18svh),10rem)] leading-[0.92] bajo:mt-2"
            >
              <span className="sr-only">Hotel {TITULO}</span>
              {/* Letra por letra, pero cada palabra se mantiene entera al saltar de línea */}
              <span aria-hidden className="flex flex-wrap gap-x-[0.25em] pb-[0.08em]">
                {TITULO.split(' ').map((palabra, p) => (
                  <span key={p} className="inline-flex overflow-hidden whitespace-nowrap">
                    {[...palabra].map((l, i) => (
                      <span
                        key={i}
                        className={cx('letra', introTerminada ? 'letra-entra' : 'opacity-0')}
                        style={{ animationDelay: `${120 + (p * 3 + i) * 55}ms` }}
                      >
                        {l}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            </h1>
            <p className="mt-5 max-w-[38ch] text-lg leading-relaxed text-luz/85 sm:text-xl bajo:mt-3 bajo:text-base bajo:leading-snug muybajo:max-w-[60ch]">
              {MARCA.lema}. Empezamos en {MARCA.anioOrigen} con una pizzería; hoy también te
              recibimos para quedarte.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 bajo:mt-4">
              <Link
                to="/solicitar"
                viewTransition
                className="boton-brasa inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-lg font-semibold max-[360px]:px-5 max-[360px]:text-base bajo:min-h-11 bajo:text-base"
              >
                Solicitar disponibilidad
                <Icono nombre="flechaDerecha" className="size-5" />
              </Link>
              <a
                href="#habitaciones"
                onClick={(e) => irASeccion('habitaciones') && e.preventDefault()}
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-lg font-semibold text-luz ring-1 ring-luz/25 transition hover:bg-luz/10 max-[360px]:px-5 max-[360px]:text-base bajo:min-h-11 bajo:text-base"
              >
                <Icono nombre="cubo" className="size-5" />
                Ver habitaciones en 3D
              </a>
            </div>
          </div>
        </div>

        {!reducido && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 md:flex bajo:hidden"
          >
            <span className="etiqueta-hud text-[0.6rem] text-niebla">
              Desliza · entra por el portón
            </span>
            <span className="pulso-linea block h-12 w-px bg-brasa-2" />
          </div>
        )}
      </div>
    </section>
  );
}

// Cinta infinita bajo la portada
export function Cinta() {
  const items = ['Hotel', 'Restaurante', 'Pizzería', `Desde ${MARCA.anioOrigen}`, MARCA.ciudad];
  const fila = [...items, ...items, ...items];
  return (
    <div aria-hidden className="relative overflow-hidden border-y border-luz/10 bg-noche-2 py-5">
      <div className="cinta flex w-max gap-10 whitespace-nowrap font-display text-3xl text-luz/80 sm:text-4xl">
        {[...fila, ...fila].map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            {t}
            <Icono nombre="chispa" className="size-6 text-brasa" />
          </span>
        ))}
      </div>
    </div>
  );
}
