import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { enlaceSolicitud, type HabitacionVitrina } from '../../../config/habitaciones';
import { useMovimientoReducido } from '../../../hooks/useMovimientoReducido';
import { cx } from '../../ui';
import { Icono, type NombreIcono } from '../Iconos';
import { Carrusel, type Diapositiva } from './Carrusel';
import type { ImagenVista } from './vistas';

const PUNTOS_MAQUETA = ['camas', 'ventana', 'mesa de noche', 'armario', 'entrada'];

// Tarjeta de habitación: carrusel (fotos reales si las hay + vistas de la maqueta 3D), capacidad,
// "Más información" desplegable y acciones. Se inclina y brilla siguiendo el puntero.
export function TarjetaHabitacion({
  habitacion,
  servicios,
  alExplorar,
  indice,
}: {
  habitacion: HabitacionVitrina;
  servicios: string[];
  alExplorar: () => void;
  indice: number;
}) {
  const raiz = useRef<HTMLElement>(null);
  const [vistas, setVistas] = useState<ImagenVista[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const reducido = useMovimientoReducido();
  const idMas = useId();
  const { ficha } = habitacion;

  // Las vistas 3D se generan cuando la tarjeta se acerca a la pantalla
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let cancelado = false;
    const observador = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        observador.disconnect();
        import('./vistas')
          .then(({ vistasDe }) => vistasDe(ficha))
          .then((v) => !cancelado && setVistas(v))
          .catch(() => !cancelado && setFallo(true));
      },
      { rootMargin: '600px 0px' },
    );
    observador.observe(el);
    return () => {
      cancelado = true;
      observador.disconnect();
    };
  }, [ficha]);

  const diapositivas: Diapositiva[] = [
    ...ficha.fotos.map((f) => ({ src: f.src, alt: f.alt, etiqueta: 'Fotografía' })),
    ...(vistas ?? []).map((v) => ({
      src: v.url,
      alt: `Maqueta ilustrativa de ${habitacion.nombre}: ${v.nombre.toLowerCase()}`,
      etiqueta: `Maqueta 3D · ${v.nombre}`,
    })),
  ];

  const mover = (e: PointerEvent<HTMLElement>) => {
    const el = raiz.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    if (!reducido)
      el.style.transform = `perspective(1100px) rotateX(${(0.5 - py) * 4}deg) rotateY(${(px - 0.5) * 5}deg)`;
  };
  const salir = () => {
    if (raiz.current) raiz.current.style.transform = '';
  };

  const datos: Array<{ icono: NombreIcono; texto: string }> = [
    {
      icono: 'personas',
      texto: habitacion.personas === 1 ? '1 persona' : `${habitacion.personas} personas`,
    },
    { icono: 'cama', texto: ficha.camas === 1 ? '1 cama' : `${ficha.camas} camas` },
    ficha.metros
      ? { icono: 'metros', texto: `${ficha.metros} m²` }
      : { icono: 'cubo', texto: 'Maqueta 3D' },
  ];

  return (
    <div data-revelar style={{ ['--retraso' as string]: indice }} className="revelar flex min-w-0">
      <article
        ref={raiz}
        onPointerMove={mover}
        onPointerLeave={salir}
        className="group relative flex w-full min-w-0 flex-col overflow-hidden rounded-3xl bg-noche-2 ring-1 ring-luz/10 transition-[transform,box-shadow] duration-300 ease-out hover:shadow-[0_30px_80px_-30px_rgb(240_160_75/0.35)]"
      >
        <div
          aria-hidden
          className="brillo-puntero pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <Carrusel
          diapositivas={diapositivas}
          titulo={`Imágenes de ${habitacion.nombre}`}
          cargando={!vistas && !fallo && ficha.fotos.length === 0}
          className="aspect-[3/2]"
        >
          <button
            type="button"
            onClick={alExplorar}
            className="vidrio absolute bottom-3 right-3 z-20 inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-xs font-semibold text-luz transition hover:bg-luz hover:text-noche"
          >
            <Icono nombre="cubo" className="size-4" />
            Explorar en 3D
          </button>
        </Carrusel>

        <div className="relative z-20 flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <h3 className="min-w-0 text-2xl">{habitacion.nombre}</h3>
            {habitacion.referencia && (
              <span className="etiqueta-hud mt-1 shrink-0 rounded-full px-2 py-1 text-[0.58rem] text-niebla ring-1 ring-luz/15">
                Referencia
              </span>
            )}
          </div>

          <ul className="mt-5 grid grid-cols-3 divide-x divide-luz/10 border-b border-luz/10 pb-5 text-center">
            {datos.map((d) => (
              <li key={d.icono} className="flex flex-col items-center gap-2 px-1">
                <Icono nombre={d.icono} className="size-7 text-brasa-2" />
                <span className="text-sm text-luz/90">{d.texto}</span>
              </li>
            ))}
          </ul>

          {ficha.comodidades.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-b border-luz/10 py-4">
              {ficha.comodidades.map((c) => (
                <li key={c} className="rounded-full px-3 py-1 text-sm ring-1 ring-luz/15">
                  {c}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setAbierta((a) => !a)}
            aria-expanded={abierta}
            aria-controls={idMas}
            className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brasa-2 hover:underline"
          >
            Más información
            <Icono
              nombre="abajo"
              className={cx('size-4 transition-transform duration-300', abierta && 'rotate-180')}
            />
          </button>
          <div
            id={idMas}
            className={cx(
              'grid transition-[grid-template-rows] duration-500 ease-out',
              abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden" inert={!abierta}>
              <div className="flex flex-col gap-3 pt-3 text-sm text-niebla">
                <p className="text-base text-luz/90">{habitacion.descripcion}</p>
                <p>
                  <span className="text-luz">En la maqueta: </span>
                  {PUNTOS_MAQUETA.join(', ')}.
                </p>
                {servicios.length > 0 && (
                  <p>
                    <span className="text-luz">En el hotel: </span>
                    {servicios.join(', ')}.
                  </p>
                )}
                <p className="text-xs">
                  Las imágenes son de una maqueta ilustrativa. Al responder tu solicitud te
                  confirmamos la distribución, las camas y la tarifa.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-5">
            <Link
              to={enlaceSolicitud(habitacion)}
              viewTransition
              className="boton-brasa inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold"
            >
              Solicitar
              <Icono nombre="flechaDerecha" className="size-4" />
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
