import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { mensajeDeError } from '../../api/errors';
import type { EstadoCama, EstadoHabitacion } from '../../api/tipos';
import { Encabezado, FilaReserva, Panel } from '../../components/admin/comunes';
import { Aviso, Cargando, cx } from '../../components/ui';
import { ESTILO_CAMA, ETIQUETA_CAMA, ETIQUETA_HABITACION } from '../../lib/estados';
import { fechaLarga } from '../../lib/fechas';
import { usePermiso, useTitulo } from '../../hooks/useSesion';

const ETIQUETA_DETALLE: Record<string, string> = {
  ocupadas: 'Camas ocupadas',
  enServicio: 'Camas en servicio',
  camasNocheOcupadas: 'Camas-noche ocupadas',
  camasNocheDisponibles: 'Camas-noche disponibles',
  recibidas: 'Registradas',
  convertidas: 'Confirmadas',
};

const ORDEN_HAB: EstadoHabitacion[] = ['DISPONIBLE', 'PARCIAL', 'OCUPADA', 'FUERA_DE_SERVICIO'];
const ORDEN_CAMA: EstadoCama[] = [
  'DISPONIBLE',
  'RETENIDA',
  'OCUPADA',
  'BLOQUEADA',
  'MANTENIMIENTO',
];

export default function Tablero() {
  useTitulo('Tablero');
  const puedeGestionar = usePermiso('reservas:gestionar');
  const { data, isLoading, error } = useQuery({
    queryKey: ['tablero'],
    queryFn: admin.tablero,
    refetchInterval: 60_000,
  });

  if (isLoading) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  return (
    <>
      <Encabezado
        titulo="Tablero"
        descripcion={`Hoy es ${fechaLarga(data.hoy)}.`}
        acciones={
          puedeGestionar && (
            <Link
              to="/panel/reservas/nueva"
              className="inline-flex min-h-11 items-center rounded-md bg-porton px-4 font-semibold text-cal hover:bg-porton-2"
            >
              Nueva reserva
            </Link>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel titulo={`Llegadas de hoy (${data.llegadas.length})`}>
          {data.llegadas.length === 0 ? (
            <p className="text-piedra">No hay llegadas programadas para hoy.</p>
          ) : (
            <ul className="-mx-2">
              {data.llegadas.map((r) => (
                <FilaReserva key={r.id} r={r} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel titulo={`Salidas de hoy (${data.salidas.length})`}>
          {data.salidas.length === 0 ? (
            <p className="text-piedra">No hay salidas programadas para hoy.</p>
          ) : (
            <ul className="-mx-2">
              {data.salidas.map((r) => (
                <FilaReserva key={r.id} r={r} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          titulo={`Por responder (${data.pendientes.total})`}
          acciones={
            data.pendientes.total > data.pendientes.primeras.length && (
              <Link
                to="/panel/reservas?estado=SOLICITUD&estado=PENDIENTE_CONFIRMACION&orden=creacion"
                className="text-sm font-semibold text-porton underline underline-offset-4"
              >
                Ver todas
              </Link>
            )
          }
        >
          {data.pendientes.total === 0 ? (
            <p className="text-piedra">No hay solicitudes pendientes.</p>
          ) : (
            <ul className="-mx-2">
              {data.pendientes.primeras.map((r) => (
                <FilaReserva key={r.id} r={r} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel titulo="Habitaciones esta noche">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ORDEN_HAB.map((e) => (
              <div key={e} className="rounded-md bg-cal-2 px-3 py-2">
                <dt className="text-sm text-piedra">{ETIQUETA_HABITACION[e]}</dt>
                <dd className="text-3xl font-semibold tabular-nums">{data.habitaciones[e]}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel
          titulo="Camas esta noche"
          acciones={
            <Link
              to="/panel/ocupacion"
              className="text-sm font-semibold text-porton underline underline-offset-4"
            >
              Ver ocupación
            </Link>
          }
        >
          <ul className="flex flex-wrap gap-2">
            {ORDEN_CAMA.map((e) => (
              <li key={e} className={cx('rounded-md px-3 py-2', ESTILO_CAMA[e])}>
                <span className="text-2xl font-semibold tabular-nums">{data.camas[e]}</span>{' '}
                <span className="text-sm">{ETIQUETA_CAMA[e]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section aria-labelledby="titulo-indicadores" className="mt-5">
        <h2 id="titulo-indicadores" className="mb-3 font-sans text-lg font-semibold">
          Indicadores
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {data.indicadores.map((i) => (
            <Panel key={i.clave}>
              <p className="font-semibold">{i.nombre}</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-porton">
                {i.valor === null ? 'Sin datos' : `${i.valor.toLocaleString('es-CO')} ${i.unidad}`}
              </p>
              <p className="mt-2 text-sm text-piedra">{i.periodo}</p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-porton">Cómo se calcula</summary>
                <p className="mt-1 text-hierro-2">{i.formula}</p>
                <p className="mt-1 text-piedra">
                  {Object.entries(i.detalle)
                    .map(([k, v]) => `${ETIQUETA_DETALLE[k] ?? k}: ${v.toLocaleString('es-CO')}`)
                    .join('; ')}
                </p>
              </details>
            </Panel>
          ))}
        </div>
      </section>
    </>
  );
}
