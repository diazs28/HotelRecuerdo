// Fachada colonial de Popayán dibujada a línea: muro encalado, tejado de barro, portón de madera
// y balcón de hierro forjado. Se traza una sola vez al cargar (sin animación si se pide menos
// movimiento). Es una ilustración, no una foto del hotel.

const L = { pathLength: 1, className: 'trazo' } as const;

export function Fachada({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 380"
      className={className}
      role="img"
      aria-label="Ilustración de una fachada colonial blanca de Popayán con portón verde y balcón de hierro"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Portón y ventanas rellenos (aparecen con el trazo) */}
      <path
        d="M168 372V262a42 42 0 0 1 84 0v110Z"
        fill="var(--color-porton)"
        stroke="none"
        opacity="0.92"
      />
      <rect
        x="58"
        y="246"
        width="60"
        height="78"
        fill="var(--color-porton)"
        stroke="none"
        opacity="0.92"
      />
      <rect
        x="302"
        y="246"
        width="60"
        height="78"
        fill="var(--color-porton)"
        stroke="none"
        opacity="0.92"
      />
      <rect
        x="72"
        y="96"
        width="56"
        height="92"
        fill="var(--color-porton)"
        stroke="none"
        opacity="0.92"
      />
      <rect
        x="292"
        y="96"
        width="56"
        height="92"
        fill="var(--color-porton)"
        stroke="none"
        opacity="0.92"
      />

      {/* Tejado de barro */}
      <path {...L} d="M6 62 L210 18 L414 62" />
      <path {...L} d="M18 62h384" />
      <path
        {...L}
        d="M30 62v-8M54 62v-12M78 62v-16M102 62v-21M126 62v-26M150 62v-31M174 62v-36M198 62v-40M222 62v-40M246 62v-36M270 62v-31M294 62v-26M318 62v-21M342 62v-16M366 62v-12M390 62v-8"
        stroke="var(--color-ocre)"
        strokeWidth="1.6"
      />

      {/* Muro encalado */}
      <path {...L} d="M24 62v310M396 62v310M4 372h412" />
      <path {...L} d="M24 214h372" strokeWidth="1.4" opacity="0.5" />

      {/* Balcones de hierro del segundo piso */}
      <path {...L} d="M60 188h80M60 218h80M60 188v30M140 188v30" />
      <path
        {...L}
        d="M72 188v30M84 188v30M96 188v30M108 188v30M120 188v30M132 188v30"
        strokeWidth="1.4"
      />
      <path {...L} d="M64 203c10-8 20 8 30 0s20 8 30 0 12-6 12-6" strokeWidth="1.4" />
      <path {...L} d="M280 188h80M280 218h80M280 188v30M360 188v30" />
      <path
        {...L}
        d="M292 188v30M304 188v30M316 188v30M328 188v30M340 188v30M352 188v30"
        strokeWidth="1.4"
      />
      <path {...L} d="M284 203c10-8 20 8 30 0s20 8 30 0 12-6 12-6" strokeWidth="1.4" />
      <path
        {...L}
        d="M72 96h56v92M72 96v92M100 96v92M292 96h56v92M292 96v92M320 96v92"
        strokeWidth="1.6"
      />

      {/* Ventanas con reja del primer piso */}
      <path {...L} d="M58 246h60v78H58ZM302 246h60v78h-60Z" />
      <path
        {...L}
        d="M73 246v78M88 246v78M103 246v78M317 246v78M332 246v78M347 246v78"
        stroke="var(--color-cal)"
        strokeWidth="1.4"
      />

      {/* Portón en arco con su marco de piedra */}
      <path {...L} d="M158 372V262a52 52 0 0 1 104 0v110" />
      <path {...L} d="M168 372V262a42 42 0 0 1 84 0v110" />
      <path {...L} d="M210 222v150" stroke="var(--color-cal)" strokeWidth="1.6" />
      <circle cx="200" cy="318" r="3" fill="var(--color-ocre)" stroke="none" />
      <circle cx="220" cy="318" r="3" fill="var(--color-ocre)" stroke="none" />

      {/* Placa con el año de origen */}
      <path {...L} d="M176 112h68v34h-68Z" strokeWidth="1.6" />
      <text
        x="210"
        y="136"
        textAnchor="middle"
        fill="var(--color-hierro)"
        stroke="none"
        fontFamily="var(--font-display)"
        fontSize="20"
      >
        1979
      </text>
    </svg>
  );
}
