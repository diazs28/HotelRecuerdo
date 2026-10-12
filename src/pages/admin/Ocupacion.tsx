import { Fragment } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { mensajeDeError } from '../../api/errors';
import type { EstadoCama, OcupacionMapa } from '../../api/tipos';
import { Encabezado } from '../../components/admin/comunes';
import { Aviso, Boton, Campo, Cargando, cx } from '../../components/ui';
import { ESTILO_CAMA, ETIQUETA_CAMA, ETIQUETA_HABITACION } from '../../lib/estados';
import {
  diaDelMes,
  diasEntre,
  esFinDeSemana,
  fechaCorta,
  hoyEnHotel,
  inicialDia,
  sumarDias,
} from '../../lib/fechas';
import { useTitulo } from '../../hooks/useSesion';

const DIAS = 14;

function estadoDe(o: OcupacionMapa): EstadoCama {
  if (o.bloqueo) return o.bloqueo.tipo === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'BLOQUEADA';
  return o.reserva?.estado === 'SOLICITUD' || o.reserva?.estado === 'PENDIENTE_CONFIRMACION'
    ? 'RETENIDA'
    : 'OCUPADA';
}

function texto(o: OcupacionMapa): string {
  if (o.bloqueo) return o.bloqueo.motivo;
  return `${o.reserva?.codigo ?? ''}${o.reserva?.titular ? ` ${o.reserva.titular}` : ''}`;
}

// Mapa de camas × noches: muestra de un vistazo qué camas están libres, ocupadas o fuera de servicio
export default function Ocupacion() {
  useTitulo('Ocupación de camas');
  const [params, setParams] = useSearchParams();
  const desde = params.get('desde') ?? hoyEnHotel();
  const hasta = sumarDias(desde, DIAS);
  const dias = diasEntre(desde, hasta);
  const hoy = hoyEnHotel();

  const { data, isLoading, error } = useQuery({
    queryKey: ['mapa', desde, hasta],
    queryFn: () => admin.mapa(desde, hasta),
    placeholderData: keepPreviousData,
  });
  const ir = (d: string) => setParams(d === hoy ? {} : { desde: d }, { replace: true });

  return (
    <>
      <Encabezado
        titulo="Ocupación de camas"
        descripcion={`Del ${fechaCorta(desde)} al ${fechaCorta(sumarDias(hasta, -1))}. Cada columna es una noche; el estado de la columna izquierda es el de la primera noche.`}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Boton variante="secundario" onClick={() => ir(sumarDias(desde, -7))}>
          Semana anterior
        </Boton>
        <Boton variante="secundario" onClick={() => ir(hoy)}>
          Hoy
        </Boton>
        <Boton variante="secundario" onClick={() => ir(sumarDias(desde, 7))}>
          Semana siguiente
        </Boton>
        <div className="w-44">
          <Campo
            etiqueta="Ir a la fecha"
            type="date"
            value={desde}
            onChange={(e) => e.target.value && ir(e.target.value)}
          />
        </div>
      </div>
      <ul className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Convenciones">
        {(Object.keys(ETIQUETA_CAMA) as EstadoCama[]).map((e) => (
          <li key={e} className={cx('rounded px-2 py-1', ESTILO_CAMA[e])}>
            {ETIQUETA_CAMA[e]}
          </li>
        ))}
      </ul>

      {isLoading && <Cargando />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      {data && (
        <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-linea">
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">Ocupación por habitación y cama</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-white px-3 py-2 text-left">
                  Cama
                </th>
                {dias.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className={cx(
                      'w-11 border-l border-linea px-1 py-1 text-center font-normal',
                      esFinDeSemana(d) && 'bg-cal-2',
                      d === hoy && 'bg-ocre-claro font-semibold',
                    )}
                  >
                    <span className="block text-xs text-piedra">{inicialDia(d)}</span>
                    {diaDelMes(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.habitaciones.map((h) => (
                <Fragment key={h.id}>
                  <tr className="border-t-2 border-hierro/70 bg-cal">
                    <th
                      scope="rowgroup"
                      colSpan={dias.length + 1}
                      className="px-3 py-1.5 text-left"
                    >
                      Habitación {h.numero}{' '}
                      <span className="font-normal text-piedra">
                        {h.tipoHabitacion.nombre}, {ETIQUETA_HABITACION[h.estado].toLowerCase()}
                      </span>
                    </th>
                  </tr>
                  {h.camas.map((c) => {
                    // Celdas: cada ocupación ocupa sus noches dentro del rango
                    const celdas: Array<{
                      dia: string;
                      ocupacion: OcupacionMapa | null;
                      span: number;
                    }> = [];
                    let i = 0;
                    while (i < dias.length) {
                      const d = dias[i]!;
                      const o = c.ocupaciones.find(
                        (x) => x.desde <= d && (x.hasta === null || d < x.hasta),
                      );
                      if (!o) {
                        celdas.push({ dia: d, ocupacion: null, span: 1 });
                        i += 1;
                        continue;
                      }
                      let span = 1;
                      while (
                        i + span < dias.length &&
                        (o.hasta === null || dias[i + span]! < o.hasta)
                      )
                        span += 1;
                      celdas.push({ dia: d, ocupacion: o, span });
                      i += span;
                    }
                    return (
                      <tr key={c.id} className="border-t border-linea/70">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-white px-3 py-1 text-left font-normal whitespace-nowrap"
                        >
                          Cama {c.identificador}{' '}
                          <span
                            className={cx('ml-1 rounded px-1.5 text-xs', ESTILO_CAMA[c.estado])}
                          >
                            {ETIQUETA_CAMA[c.estado]}
                          </span>
                        </th>
                        {celdas.map(({ dia, ocupacion, span }) =>
                          ocupacion ? (
                            <td key={dia} colSpan={span} className="border-l border-linea p-0.5">
                              {ocupacion.reserva ? (
                                <Link
                                  to={`/panel/reservas/${ocupacion.reserva.id}`}
                                  title={texto(ocupacion)}
                                  className={cx(
                                    'block truncate rounded px-1.5 py-1',
                                    ESTILO_CAMA[estadoDe(ocupacion)],
                                  )}
                                  style={{ maxWidth: `${span * 2.75}rem` }}
                                >
                                  {texto(ocupacion)}
                                </Link>
                              ) : (
                                <span
                                  title={texto(ocupacion)}
                                  className={cx(
                                    'block truncate rounded px-1.5 py-1',
                                    ESTILO_CAMA[estadoDe(ocupacion)],
                                  )}
                                  style={{ maxWidth: `${span * 2.75}rem` }}
                                >
                                  {texto(ocupacion)}
                                </span>
                              )}
                            </td>
                          ) : (
                            <td
                              key={dia}
                              className={cx(
                                'border-l border-linea',
                                esFinDeSemana(dia) && 'bg-cal/60',
                              )}
                            >
                              <span className="sr-only">Libre</span>
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.habitaciones.length === 0 && (
        <div className="mt-4">
          <Aviso tono="pendiente">
            Aún no hay habitaciones configuradas.{' '}
            <Link className="underline" to="/panel/habitaciones">
              Configúralas aquí
            </Link>
            .
          </Aviso>
        </div>
      )}
    </>
  );
}
