import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import type { EstadoReserva } from '../../api/tipos';
import { ESTILO_ESTADO, ETIQUETA_ESTADO } from '../../lib/estados';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');
export { cx };

// ---------- Botones ----------

type Variante = 'principal' | 'secundario' | 'peligro' | 'sutil';

const VARIANTES: Record<Variante, string> = {
  principal: 'bg-porton text-cal hover:bg-porton-2 disabled:bg-piedra',
  secundario: 'bg-white text-hierro ring-1 ring-inset ring-linea hover:bg-cal-2',
  peligro: 'bg-ladrillo text-white hover:bg-ladrillo/90',
  sutil: 'text-porton hover:bg-porton-claro',
};

export function Boton({
  variante = 'principal',
  cargando = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTES[variante],
        className,
      )}
    >
      {cargando && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}

// ---------- Campos de formulario ----------

interface BaseCampo {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
}

function Envoltura({
  id,
  etiqueta,
  error,
  ayuda,
  requerido,
  children,
}: BaseCampo & { id: string; requerido?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-hierro">
        {etiqueta}
        {requerido && <span className="text-ladrillo"> *</span>}
      </label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="text-sm text-piedra">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-ladrillo" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const estiloCampo = (error?: string) =>
  cx(
    'min-h-11 w-full rounded-md border bg-white px-3 py-2 text-base text-hierro placeholder:text-piedra/80',
    'focus:border-porton focus:outline-none focus:ring-2 focus:ring-porton',
    error ? 'border-ladrillo' : 'border-linea',
  );

function describedBy(id: string, error?: string, ayuda?: ReactNode) {
  return error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  className,
  ...props
}: BaseCampo & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} requerido={props.required}>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={cx(estiloCampo(error), className)}
      />
    </Envoltura>
  );
}

export function Selector({
  etiqueta,
  error,
  ayuda,
  children,
  ...props
}: BaseCampo & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} requerido={props.required}>
      <select
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={estiloCampo(error)}
      >
        {children}
      </select>
    </Envoltura>
  );
}

export function AreaTexto({
  etiqueta,
  error,
  ayuda,
  ...props
}: BaseCampo & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} requerido={props.required}>
      <textarea
        id={id}
        rows={3}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={estiloCampo(error)}
      />
    </Envoltura>
  );
}

export function Casilla({
  etiqueta,
  error,
  ...props
}: { etiqueta: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-base">
        <input
          id={id}
          type="checkbox"
          {...props}
          aria-invalid={error ? true : undefined}
          className="mt-1 size-5 shrink-0 accent-porton"
        />
        <span>{etiqueta}</span>
      </label>
      {error && (
        <p className="mt-1 text-sm font-medium text-ladrillo" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- Mensajes ----------

export function Aviso({
  tono = 'info',
  titulo,
  children,
}: {
  tono?: 'info' | 'error' | 'exito' | 'pendiente';
  titulo?: string;
  children?: ReactNode;
}) {
  const estilos = {
    info: 'border-linea bg-white text-hierro',
    error: 'border-ladrillo/40 bg-ladrillo-claro text-ladrillo',
    exito: 'border-porton/30 bg-porton-claro text-porton-2',
    pendiente: 'border-ocre/40 bg-ocre-claro text-ocre-texto',
  } as const;
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={cx('rounded-md border-l-4 px-4 py-3', estilos[tono])}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className="text-base">{children}</div>}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-piedra">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-porton border-r-transparent"
      />
      {texto}
    </p>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-linea px-6 py-8 text-center">
      <p className="font-semibold text-hierro">{titulo}</p>
      {children && <div className="mt-1 text-piedra">{children}</div>}
    </div>
  );
}

export function InsigniaEstado({ estado }: { estado: EstadoReserva }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset',
        ESTILO_ESTADO[estado],
      )}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

// ---------- Diálogo modal (elemento <dialog> nativo: foco atrapado y Escape) ----------

export function Dialogo({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      aria-labelledby="titulo-dialogo"
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-lg bg-cal p-0 text-hierro shadow-xl backdrop:bg-hierro/50',
        ancho,
      )}
    >
      {abierto && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="titulo-dialogo" className="text-xl">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="-m-2 rounded-md p-2 text-piedra hover:bg-cal-2"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Paginacion({
  pagina,
  total,
  porPagina,
  onCambiar,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  onCambiar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-4">
      <Boton variante="secundario" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        Anterior
      </Boton>
      <span className="text-sm text-piedra">
        Página {pagina} de {paginas}
      </span>
      <Boton
        variante="secundario"
        disabled={pagina >= paginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        Siguiente
      </Boton>
    </nav>
  );
}
