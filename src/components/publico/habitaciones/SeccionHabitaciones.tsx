import { useMemo, useRef, useState } from 'react';
import type { DatosPublicos } from '../../../api/tipos';
import {
  armarVitrina,
  enlaceSolicitud,
  type HabitacionVitrina,
} from '../../../config/habitaciones';
import { useRevelar } from '../../../hooks/useRevelar';
import { EncabezadoSeccion } from '../EncabezadoSeccion';
import { Explorador3D } from './Explorador3D';
import { TarjetaHabitacion } from './TarjetaHabitacion';

const NOMBRES_SERVICIO = {
  servicio_desayuno: 'desayuno',
  servicio_parqueadero: 'parqueadero',
  servicio_wifi: 'Wi-Fi',
} as const;

export function SeccionHabitaciones({ datos }: { datos: DatosPublicos | undefined }) {
  const raiz = useRef<HTMLElement>(null);
  const [explorando, setExplorando] = useState<HabitacionVitrina | null>(null);
  const vitrina = useMemo(() => armarVitrina(datos?.tiposHabitacion ?? []), [datos]);
  const servicios = useMemo(
    () =>
      (Object.keys(NOMBRES_SERVICIO) as Array<keyof typeof NOMBRES_SERVICIO>)
        .filter((k) => datos?.ajustes[k])
        .map((k) => NOMBRES_SERVICIO[k]),
    [datos],
  );
  useRevelar(raiz, [vitrina.length]);

  return (
    <section
      ref={raiz}
      id="habitaciones"
      aria-labelledby="titulo-habitaciones"
      className="relative scroll-mt-20 px-4 py-24 sm:px-6 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <EncabezadoSeccion
          numero="02"
          etiqueta="Habitaciones"
          id="titulo-habitaciones"
          titulo="Elige dónde despertar en Popayán"
        >
          Recorre cada habitación en una maqueta 3D: gírala, acércate y mira lo que contiene antes
          de escribirnos.
          {vitrina[0]?.referencia &&
            ' Estos son tipos de referencia: al responder tu solicitud te confirmamos cuáles están disponibles.'}
        </EncabezadoSeccion>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:gap-8">
          {vitrina.map((h, i) => (
            <TarjetaHabitacion
              key={h.clave}
              habitacion={h}
              servicios={servicios}
              indice={i % 2}
              alExplorar={() => setExplorando(h)}
            />
          ))}
        </div>
      </div>

      {explorando && (
        <Explorador3D
          habitacion={explorando}
          enlaceSolicitar={enlaceSolicitud(explorando)}
          alCerrar={() => setExplorando(null)}
        />
      )}
    </section>
  );
}
