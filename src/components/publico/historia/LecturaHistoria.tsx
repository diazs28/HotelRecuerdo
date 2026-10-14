import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { LINEA_TIEMPO, NOMBRE_AMBITO, type Capitulo } from '../../../config/historia';
import { useRevelar } from '../../../hooks/useRevelar';
import { cx } from '../../ui';
import { EncabezadoSeccion } from '../EncabezadoSeccion';
import { Icono } from '../Iconos';
import { PalabraGigante } from '../PalabraGigante';

// Relleno del año gigante según a quién pertenece el hecho
const RELLENO: Record<Capitulo['ambito'], string> = {
  casa: 'linear-gradient(180deg, #ffc477 0%, #f0a04b 45%, #d0611f 100%)',
  ciudad: 'linear-gradient(180deg, #a8ecce 0%, #5cc59a 50%, #2f8a64 100%)',
  visitante: 'linear-gradient(180deg, #ffffff 0%, #f3efe4 50%, #a3afba 100%)',
};
const COLOR_AMBITO: Record<Capitulo['ambito'], string> = {
  casa: 'text-brasa-2',
  ciudad: 'text-jade',
  visitante: 'text-luz',
};
const dos = (n: number) => String(n).padStart(2, '0');

// Historia para celulares (y para quien prefiere menos movimiento), inspirada en la sección de
// servicios de BWL & SOFT: el año queda fijo y gigante arriba, con textura de cartel, y cambia
// letra por letra según el capítulo que se está leyendo; ese capítulo se enciende (línea de
// brasa, icono que se dibuja) y los demás quedan en segundo plano. Sin tarjetas.
export function LecturaHistoria({ anios }: { anios: number }) {
  const raiz = useRef<HTMLElement>(null);
  const capitulos = useRef<Array<HTMLLIElement | null>>([]);
  const [activo, setActivo] = useState(0);
  useRevelar(raiz);

  // El capítulo activo es el que cruza la franja central de la pantalla
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const i = capitulos.current.indexOf(e.target as HTMLLIElement);
          if (i >= 0) setActivo(i);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    capitulos.current.forEach((el) => el && observador.observe(el));
    return () => observador.disconnect();
  }, []);

  const c = LINEA_TIEMPO[activo]!;
  const total = LINEA_TIEMPO.length;

  return (
    <section
      ref={raiz}
      id="historia"
      aria-labelledby="titulo-historia"
      className="relative scroll-mt-20 px-4 pb-16 pt-24 sm:px-6"
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

        {/* Año gigante fijo bajo el menú mientras se recorren los capítulos */}
        <div className="historia-fija sticky top-16 z-10 -mx-4 mt-10 bg-noche px-4 pb-4 pt-3 sm:-mx-6 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <PalabraGigante
              texto={c.marca}
              className="gigante-cartel text-[clamp(4.5rem,27vw,9rem)]"
              estilo={{ '--relleno': RELLENO[c.ambito] } as CSSProperties}
            />
            <div aria-hidden className="shrink-0 pb-4 text-right">
              <p
                className={cx(
                  'etiqueta-hud text-[0.6rem] transition-colors duration-500',
                  COLOR_AMBITO[c.ambito],
                )}
              >
                {NOMBRE_AMBITO[c.ambito]}
              </p>
              <p className="mt-1 font-mono text-xs text-niebla">
                {dos(activo + 1)} / {dos(total)}
              </p>
            </div>
          </div>
          <div aria-hidden className="mt-1 flex gap-1">
            {LINEA_TIEMPO.map((x, i) => (
              <span
                key={x.id}
                className={cx(
                  'h-0.5 flex-1 rounded-full transition-colors duration-500',
                  i <= activo ? 'bg-brasa-2' : 'bg-luz/15',
                )}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {c.marca}: {c.titulo}
          </p>
        </div>

        <ol>
          {LINEA_TIEMPO.map((cap, i) => (
            <li
              key={cap.id}
              ref={(el) => {
                capitulos.current[i] = el;
              }}
              className={cx(
                'capitulo relative border-t border-luz/10 pb-14 pt-10 transition-opacity duration-500',
                i === activo ? 'capitulo-activo' : 'opacity-35',
              )}
            >
              <Icono nombre={cap.icono} trazo className="size-9 text-brasa-2" />
              <p className={cx('etiqueta-hud mt-5 text-[0.62rem]', COLOR_AMBITO[cap.ambito])}>
                {NOMBRE_AMBITO[cap.ambito]} · {cap.marca}
              </p>
              <h3 className="mt-2 text-[1.7rem] leading-tight">{cap.titulo}</h3>
              <p className="mt-3 max-w-prose text-lg text-niebla">{cap.texto}</p>
              {cap.ambito === 'visitante' && (
                <Link
                  to="/solicitar"
                  viewTransition
                  className="boton-brasa mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold"
                >
                  Escribir mi capítulo
                  <Icono nombre="flechaDerecha" className="size-4" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
