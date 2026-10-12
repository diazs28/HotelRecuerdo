import type { ReactNode } from 'react';
import { cx } from '../ui';

// Encabezado común de las secciones del inicio: número y etiqueta tipo HUD, título y entrada
export function EncabezadoSeccion({
  numero,
  etiqueta,
  titulo,
  id,
  children,
  className,
}: {
  numero: string;
  etiqueta: string;
  titulo: string;
  id: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('max-w-3xl', className)}>
      <p data-revelar className="revelar etiqueta-hud flex items-center gap-3 text-brasa-2">
        <span>{numero}</span>
        <span aria-hidden className="h-px w-10 bg-brasa-2/60" />
        <span>{etiqueta}</span>
      </p>
      <h2
        id={id}
        data-revelar
        style={{ ['--retraso' as string]: 1 }}
        className="revelar mt-5 text-[clamp(2.2rem,5.5vw,4.2rem)] leading-[1.02]"
      >
        {titulo}
      </h2>
      {children && (
        <p
          data-revelar
          style={{ ['--retraso' as string]: 2 }}
          className="revelar mt-5 max-w-2xl text-lg text-niebla"
        >
          {children}
        </p>
      )}
    </header>
  );
}
