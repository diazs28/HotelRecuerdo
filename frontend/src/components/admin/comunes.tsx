import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Reserva } from '../../api/tipos';
import { fechaCorta } from '../../lib/fechas';
import { InsigniaEstado } from '../ui';

export function Encabezado({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-prose text-piedra">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Panel({
  titulo,
  children,
  acciones,
  className = '',
}: {
  titulo?: string;
  children: ReactNode;
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg bg-white p-4 ring-1 ring-linea sm:p-5 ${className}`}>
      {(titulo || acciones) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="font-sans text-lg font-semibold">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

export const nombreHuesped = (r: Pick<Reserva, 'huesped'>) =>
  `${r.huesped.nombres} ${r.huesped.apellidos}`;

export function camasTexto(r: Pick<Reserva, 'camas'>): string {
  if (r.camas.length === 0) return 'Sin camas asignadas';
  return r.camas.map((c) => `${c.habitacion}-${c.identificador}`).join(', ');
}

// Fila compacta de reserva (tablero y listas)
export function FilaReserva({ r }: { r: Reserva }) {
  return (
    <li>
      <Link
        to={`/panel/reservas/${r.id}`}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md px-2 py-2.5 hover:bg-cal-2"
      >
        <span className="min-w-0">
          <span className="font-semibold text-porton">{r.codigo}</span>{' '}
          <span className="text-hierro">{nombreHuesped(r)}</span>
          <span className="block text-sm text-piedra">
            {fechaCorta(r.fechaEntrada)} – {fechaCorta(r.fechaSalida)}, {r.cantidadHuespedes}{' '}
            {r.cantidadHuespedes === 1 ? 'persona' : 'personas'}. {camasTexto(r)}
          </span>
        </span>
        <InsigniaEstado estado={r.estado} />
      </Link>
    </li>
  );
}
