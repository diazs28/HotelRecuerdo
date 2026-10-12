// Iconos de línea del sitio público (24 × 24, heredan el color del texto)

import type { SVGProps } from 'react';

const TRAZOS = {
  personas:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.6V20',
  cama: 'M3 18V7m0 7h18v4m0-4v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
  metros: 'M4 20V9m0 11h11M4 20 20 4m0 0h-6m6 0v6',
  cubo: 'M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v0M4 7.5l8 4.5 8-4.5M12 12v9',
  plano: 'M3 4h18v16H3zM3 12h7v8M14 4v7h7',
  izquierda: 'M15 5l-7 7 7 7',
  derecha: 'M9 5l7 7-7 7',
  abajo: 'M5 9l7 7 7-7',
  cerrar: 'M6 6l12 12M18 6 6 18',
  flechaDerecha: 'M4 12h16m-6-6 6 6-6 6',
  girar: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  horno:
    'M3 20h18M5 20v-7a7 7 0 0 1 14 0v7M9 20v-4a3 3 0 0 1 6 0v4M12 3c1.5 1.5-1 2.5.5 4M9 4.5c1 1-.6 1.8.3 3M15 4.5c1 1-.6 1.8.3 3',
  fachada: 'M3 21h18M4 21V9l8-5 8 5v12M9 21v-5a3 3 0 0 1 6 0v5M7 11h2v2H7zM15 11h2v2h-2z',
  plato:
    'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 4v6m0 0v10M22 4c-1.5 1-2 3-2 5h2v11',
  vela: 'M9 21h6M10 21V10h4v11M12 10V8m0-5c1.6 1.8 1.6 3.2 0 5-1.6-1.8-1.6-3.2 0-5Z',
  llave: 'M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm4-4h9m-3 0v3m-3-3v2',
  pluma: 'M20 4C11 4 6 10 5 19l1 1c2-5 6-7 9-8-2 0-4 .5-6 2 2-5 6-8 11-10Z',
  desayuno:
    'M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-4Zm13 1h1.5a2.5 2.5 0 0 1 0 5H17M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3',
  parqueadero: 'M5 4h14v16H5zM9 17V7h3.5a3 3 0 0 1 0 6H9',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.01',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  ubicacion:
    'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  telefono:
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  correo: 'M3 6h18v12H3zM3 7l9 6 9-6',
  mensaje: 'M4 20l1.5-4.5A8 8 0 1 1 8.5 19L4 20Z',
  chispa:
    'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({
  nombre,
  className = 'size-6',
  ...props
}: { nombre: NombreIcono } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
