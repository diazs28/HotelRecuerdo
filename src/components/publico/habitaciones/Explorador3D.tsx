import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { HabitacionVitrina } from '../../../config/habitaciones';
import { useMovimientoReducido } from '../../../hooks/useMovimientoReducido';
import { pausarScroll } from '../../../hooks/useScrollSuave';
import { cx } from '../../ui';
import { Icono } from '../Iconos';
import type { Explorador, PosicionPunto } from './escenaExplorador';
import type { PuntoInteres } from './maqueta';

type Estado = 'cargando' | 'listo' | 'error';

// Explorador 3D a pantalla completa: la maqueta de la habitación se gira, se acerca y se recorre
// por vistas o tocando los puntos de interés. Usa <dialog> nativo (foco atrapado y Esc para cerrar).
export function Explorador3D({
  habitacion,
  enlaceSolicitar,
  alCerrar,
}: {
  habitacion: HabitacionVitrina;
  enlaceSolicitar: string;
  alCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const pines = useRef(new Map<string, HTMLButtonElement>());
  const explorador = useRef<Explorador | null>(null);
  const [estado, setEstado] = useState<Estado>('cargando');
  const [puntos, setPuntos] = useState<PuntoInteres[]>([]);
  const [vistas, setVistas] = useState<Explorador['vistas']>([]);
  const [vistaActiva, setVistaActiva] = useState('general');
  const [punto, setPunto] = useState<PuntoInteres | null>(null);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    d.showModal();
    pausarScroll(true);
    return () => pausarScroll(false);
  }, []);

  useEffect(() => {
    let cancelado = false;
    const mover = (posiciones: PosicionPunto[]) => {
      for (const p of posiciones) {
        const el = pines.current.get(p.id);
        if (!el) continue;
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
        el.style.opacity = p.visible ? '1' : '0';
        el.style.pointerEvents = p.visible ? 'auto' : 'none';
      }
    };
    import('./escenaExplorador')
      .then(({ crearExplorador }) => {
        if (cancelado || !lienzo.current) return;
        const e = crearExplorador(lienzo.current, habitacion.ficha, { reducido, alMover: mover });
        explorador.current = e;
        setPuntos(e.puntos);
        setVistas(e.vistas);
        setEstado('listo');
      })
      .catch(() => !cancelado && setEstado('error'));
    return () => {
      cancelado = true;
      explorador.current?.liberar();
      explorador.current = null;
    };
  }, [habitacion.ficha, reducido]);

  const verVista = (id: string) => {
    const v = vistas.find((x) => x.id === id);
    if (!v) return;
    setVistaActiva(id);
    setPunto(null);
    explorador.current?.irA(v);
  };

  const verPunto = (p: PuntoInteres) => {
    setPunto(p);
    setVistaActiva('');
    explorador.current?.irA(p.vista);
  };

  const enPlano = vistaActiva === 'plano';

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="explorador-titulo"
      onClose={alCerrar}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-noche p-0 text-luz backdrop:bg-noche/80"
    >
      <div className="portal-abre relative flex h-full flex-col">
        <header className="relative z-10 flex items-start justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6 bajo:pt-3">
          <div>
            <p className="etiqueta-hud text-brasa-2">Maqueta 3D · ilustrativa</p>
            <h2 id="explorador-titulo" className="mt-1 text-2xl sm:text-4xl bajo:text-xl">
              {habitacion.nombre}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="vidrio grid size-11 shrink-0 place-items-center rounded-full transition hover:rotate-90"
            aria-label="Cerrar el explorador 3D"
          >
            <Icono nombre="cerrar" className="size-5" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div aria-hidden className={cx('rejilla absolute inset-0', enPlano && 'opacity-100')} />
          <canvas
            ref={lienzo}
            className="absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing"
            aria-label={`Maqueta 3D de ${habitacion.nombre}. Arrastra para girarla.`}
          />

          {puntos.map((p) => (
            <button
              key={p.id}
              ref={(el) => {
                if (el) pines.current.set(p.id, el);
                else pines.current.delete(p.id);
              }}
              type="button"
              onClick={() => verPunto(p)}
              aria-pressed={punto?.id === p.id}
              className="group/pin absolute left-0 top-0 flex items-center gap-2 opacity-0 transition-opacity"
            >
              <span className="relative grid size-7 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brasa/40 motion-reduce:hidden" />
                <span
                  className={cx(
                    'relative size-3.5 rounded-full ring-2 ring-noche',
                    punto?.id === p.id ? 'bg-luz' : 'bg-brasa-2',
                  )}
                />
              </span>
              <span className="etiqueta-hud vidrio rounded-full px-2.5 py-1 text-[0.6rem] text-luz opacity-0 transition group-hover/pin:opacity-100 group-focus-visible/pin:opacity-100 group-aria-pressed/pin:opacity-100">
                {p.nombre}
              </span>
            </button>
          ))}

          {estado !== 'listo' && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              {estado === 'cargando' ? (
                <div className="flex flex-col items-center gap-3 text-niebla">
                  <span className="size-12 animate-spin rounded-full border border-brasa/30 border-t-brasa" />
                  <span className="etiqueta-hud">Levantando muros…</span>
                </div>
              ) : (
                <p className="max-w-sm text-niebla">
                  Tu navegador no pudo mostrar la maqueta 3D. Puedes ver las imágenes en la tarjeta
                  de la habitación.
                </p>
              )}
            </div>
          )}

          {enPlano && (
            <p className="etiqueta-hud pointer-events-none absolute right-4 top-4 text-brasa-2 sm:right-8">
              Vista cenital · plano
            </p>
          )}

          <div
            className={cx(
              'vidrio absolute bottom-4 left-4 right-4 max-w-sm rounded-2xl p-4 sm:left-8 sm:right-auto bajo:bottom-2 bajo:p-3',
              !punto && 'bajo:hidden',
            )}
          >
            {punto ? (
              <>
                <p className="etiqueta-hud text-brasa-2">Punto de interés</p>
                <p className="mt-1 font-display text-xl">{punto.nombre}</p>
                <p className="mt-1 text-sm text-niebla">{punto.texto}</p>
              </>
            ) : (
              <p className="flex items-start gap-3 text-sm text-niebla">
                <Icono nombre="girar" className="mt-0.5 size-5 shrink-0 text-brasa-2" />
                Arrastra para girar la maqueta y pellizca o usa la rueda para acercarte. Toca un
                punto naranja para ver el detalle.
              </p>
            )}
          </div>
        </div>

        <footer className="relative z-10 flex flex-col gap-3 border-t border-luz/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 bajo:py-2">
          <div
            role="group"
            aria-label="Vistas"
            className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {vistas.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => verVista(v.id)}
                aria-pressed={vistaActiva === v.id}
                className={cx(
                  'flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition bajo:min-h-9 bajo:px-3',
                  vistaActiva === v.id
                    ? 'bg-luz text-noche'
                    : 'text-luz ring-1 ring-luz/20 hover:bg-luz/10',
                )}
              >
                <Icono nombre={v.id === 'plano' ? 'plano' : 'cubo'} className="size-4" />
                {v.nombre}
              </button>
            ))}
          </div>
          <Link
            to={enlaceSolicitar}
            viewTransition
            className="boton-brasa inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 font-semibold bajo:min-h-9 bajo:px-4 bajo:text-sm"
          >
            Solicitar esta habitación
            <Icono nombre="flechaDerecha" className="size-4" />
          </Link>
        </footer>
      </div>
    </dialog>
  );
}
