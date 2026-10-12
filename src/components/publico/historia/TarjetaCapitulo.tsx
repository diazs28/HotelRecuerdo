import { Link } from 'react-router';
import { NOMBRE_AMBITO, type Capitulo } from '../../../config/historia';
import { cx } from '../../ui';
import { Icono } from '../Iconos';

const COLOR_AMBITO: Record<Capitulo['ambito'], string> = {
  casa: 'text-brasa-2 ring-brasa-2/40',
  ciudad: 'text-jade ring-jade/40',
  visitante: 'text-luz ring-luz/40',
};

// Un capítulo de la historia: época, a quién pertenece el hecho (la casa o la ciudad) y el relato
export function TarjetaCapitulo({ capitulo, activo }: { capitulo: Capitulo; activo: boolean }) {
  return (
    <article
      className={cx(
        'vidrio rounded-3xl bg-noche-2/90 p-6 transition-[box-shadow] duration-700 sm:p-8',
        activo && 'shadow-[0_0_80px_-20px_rgb(240_160_75/0.45)]',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={cx(
            'etiqueta-hud rounded-full px-3 py-1 text-[0.6rem] ring-1',
            COLOR_AMBITO[capitulo.ambito],
          )}
        >
          {NOMBRE_AMBITO[capitulo.ambito]}
        </span>
        <span className="grid size-12 place-items-center rounded-full bg-luz/5 ring-1 ring-luz/15">
          <Icono nombre={capitulo.icono} className="size-6 text-brasa-2" />
        </span>
      </div>
      <p className="mt-6 font-display text-5xl text-luz sm:text-6xl">{capitulo.marca}</p>
      <h3 className="mt-3 text-2xl">{capitulo.titulo}</h3>
      <p className="mt-3 text-niebla">{capitulo.texto}</p>
      {capitulo.ambito === 'visitante' && (
        <Link
          to="/solicitar"
          viewTransition
          className="boton-brasa mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold"
        >
          Escribir mi capítulo
          <Icono nombre="flechaDerecha" className="size-4" />
        </Link>
      )}
    </article>
  );
}
