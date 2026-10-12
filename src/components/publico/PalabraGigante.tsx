import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cx } from '../ui';

const ESCALONADO_MS = 40;
const SALIDA_MS = 450;

interface Palabra {
  id: number;
  texto: string;
  sale: boolean;
}

// Palabra gigante letra por letra (adaptada de la vitrina de BWL & SOFT): al cambiar el texto,
// las letras de la palabra anterior se hunden una tras otra mientras emergen las de la nueva.
// Es decorativa: quien la usa debe dar el texto real en otro elemento.
export function PalabraGigante({
  texto,
  className,
  estilo,
  animarInicio = false,
}: {
  texto: string;
  className?: string;
  estilo?: CSSProperties;
  animarInicio?: boolean;
}) {
  const [palabras, setPalabras] = useState<Palabra[]>([{ id: 0, texto, sale: false }]);
  const siguiente = useRef(1);
  const ultimo = useRef(texto);

  useEffect(() => {
    if (texto === ultimo.current) return;
    ultimo.current = texto;
    const id = siguiente.current++;
    setPalabras((ps) => [...ps.map((p) => ({ ...p, sale: true })), { id, texto, sale: false }]);
    const espera = SALIDA_MS + ESCALONADO_MS * 14;
    window.setTimeout(() => setPalabras((ps) => ps.filter((p) => !p.sale || p.id > id)), espera);
  }, [texto]);

  return (
    <span aria-hidden className={cx('grid overflow-hidden', className)} style={estilo}>
      {palabras.map((p) => (
        <span key={p.id} className="col-start-1 row-start-1 whitespace-nowrap">
          {[...p.texto].map((letra, i) => (
            <span
              key={i}
              className={cx(
                'letra',
                p.sale ? 'letra-sale' : (p.id > 0 || animarInicio) && 'letra-entra',
              )}
              style={{ animationDelay: `${i * ESCALONADO_MS}ms` }}
            >
              {letra === ' ' ? ' ' : letra}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
