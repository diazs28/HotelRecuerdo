import { useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { mensajeDeError } from '../../api/errors';
import { Aviso, Cargando, cx } from '../ui';
import { ETIQUETA_TIPO_CAMA } from '../../lib/estados';

// Camas libres en [entrada, salida), calculadas por el servidor. La selección final la vuelve a
// validar la base de datos al guardar (si otra persona tomó la cama, responde 409).
export function SelectorCamas({
  entrada,
  salida,
  seleccion,
  onCambiar,
  excluirReservaId,
  personas,
}: {
  entrada: string;
  salida: string;
  seleccion: string[];
  onCambiar: (ids: string[]) => void;
  excluirReservaId?: string;
  personas: number;
}) {
  const valido = Boolean(entrada && salida && salida > entrada);
  const { data, isLoading, error } = useQuery({
    queryKey: ['camas-libres', entrada, salida, excluirReservaId],
    queryFn: () => admin.camasLibres(entrada, salida, excluirReservaId),
    enabled: valido,
  });

  if (!valido) return <p className="text-piedra">Elige las fechas para ver las camas libres.</p>;
  if (isLoading) return <Cargando texto="Buscando camas libres…" />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;
  if (data.habitaciones.length === 0) {
    return <Aviso tono="pendiente">No hay camas libres en esas fechas.</Aviso>;
  }

  const plazas = data.habitaciones
    .flatMap((h) => h.camas)
    .filter((c) => seleccion.includes(c.id))
    .reduce((s, c) => s + c.plazas, 0);
  const alternar = (id: string) =>
    onCambiar(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-piedra" aria-live="polite">
        {data.camasLibres} cama(s) libres ({data.plazasLibres} plazas). Seleccionadas: {plazas} de{' '}
        {personas} plaza(s) necesarias.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.habitaciones.map((h) => {
          const ids = h.camas.map((c) => c.id);
          const todas = ids.every((id) => seleccion.includes(id));
          return (
            <li key={h.habitacionId} className="rounded-md bg-cal p-3 ring-1 ring-linea">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  Hab. {h.numero}{' '}
                  <span className="font-normal text-piedra">
                    {h.tipoHabitacion.nombre}
                    {h.completa ? ', libre completa' : ''}
                  </span>
                </p>
                <button
                  type="button"
                  className="text-sm text-porton underline underline-offset-4"
                  onClick={() =>
                    onCambiar(
                      todas
                        ? seleccion.filter((x) => !ids.includes(x))
                        : [...new Set([...seleccion, ...ids])],
                    )
                  }
                >
                  {todas ? 'Quitar todas' : 'Elegir todas'}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {h.camas.map((c) => {
                  const marcada = seleccion.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={cx(
                        'flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm ring-1',
                        marcada ? 'bg-porton text-cal ring-porton' : 'bg-white ring-linea',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-ocre"
                        checked={marcada}
                        onChange={() => alternar(c.id)}
                      />
                      Cama {c.identificador} ({ETIQUETA_TIPO_CAMA[c.tipo]}, {c.plazas})
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
