import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { mensajeDeError } from '../../api/errors';
import type { EstadoReserva, Reserva } from '../../api/tipos';
import { Encabezado, camasTexto, nombreHuesped } from '../../components/admin/comunes';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  InsigniaEstado,
  Paginacion,
  Vacio,
  cx,
} from '../../components/ui';
import { ETIQUETA_ESTADO } from '../../lib/estados';
import {
  diaDelMes,
  diasEntre,
  esFinDeSemana,
  fechaCorta,
  hoyEnHotel,
  inicialDia,
  inicioDeMes,
  nombreMes,
  sumarMeses,
} from '../../lib/fechas';
import { usePermiso, useTitulo } from '../../hooks/useSesion';

const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoReserva[];

function Lista({ reservas }: { reservas: Reserva[] }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-linea">
      <table className="w-full min-w-[46rem] text-left">
        <caption className="sr-only">Reservas encontradas</caption>
        <thead className="border-b border-linea text-sm text-piedra">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Código
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Titular
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Estancia
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Personas
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Camas
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((r) => (
            <tr key={r.id} className="border-b border-linea/70 last:border-0 hover:bg-cal">
              <td className="px-4 py-3">
                <Link
                  to={`/panel/reservas/${r.id}`}
                  className="font-semibold text-porton underline-offset-4 hover:underline"
                >
                  {r.codigo}
                </Link>
                <span className="block text-sm text-piedra">{r.canal.nombre}</span>
              </td>
              <td className="px-4 py-3">
                {nombreHuesped(r)}
                <span className="block text-sm text-piedra">
                  {r.huesped.telefono ?? r.huesped.email}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {fechaCorta(r.fechaEntrada)} – {fechaCorta(r.fechaSalida)}
                <span className="block text-sm text-piedra">{r.noches} noche(s)</span>
              </td>
              <td className="px-4 py-3">{r.cantidadHuespedes}</td>
              <td className="px-4 py-3 text-sm">{camasTexto(r)}</td>
              <td className="px-4 py-3">
                <InsigniaEstado estado={r.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Calendario mensual: cada reserva es una barra sobre las noches que ocupa
function Calendario({ mes, reservas }: { mes: string; reservas: Reserva[] }) {
  const dias = diasEntre(mes, sumarMeses(mes, 1));
  const hoy = hoyEnHotel();
  const visibles = reservas.filter((r) => r.estado !== 'CANCELADA');
  if (visibles.length === 0) return <Vacio titulo="No hay reservas este mes" />;
  return (
    <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-linea">
      <div
        className="grid min-w-max text-sm"
        style={{ gridTemplateColumns: `minmax(11rem,14rem) repeat(${dias.length}, 2rem)` }}
      >
        <div className="sticky left-0 z-10 border-b border-linea bg-white px-3 py-2 font-semibold">
          Reserva
        </div>
        {dias.map((d) => (
          <div
            key={d}
            className={cx(
              'border-b border-l border-linea py-1 text-center',
              esFinDeSemana(d) && 'bg-cal-2',
              d === hoy && 'bg-ocre-claro font-semibold',
            )}
          >
            <span className="block text-xs text-piedra">{inicialDia(d)}</span>
            {diaDelMes(d)}
          </div>
        ))}
        {visibles.map((r) => {
          const ini = Math.max(0, dias.indexOf(r.fechaEntrada < mes ? mes : r.fechaEntrada));
          const finIdx = dias.findIndex((d) => d >= r.fechaSalida);
          const fin = finIdx === -1 ? dias.length : finIdx;
          const provisional = r.estado === 'SOLICITUD' || r.estado === 'PENDIENTE_CONFIRMACION';
          return (
            <div key={r.id} className="contents">
              <Link
                to={`/panel/reservas/${r.id}`}
                className="sticky left-0 z-10 truncate border-b border-linea/70 bg-white px-3 py-1.5 hover:text-porton"
              >
                <span className="font-semibold">{r.codigo}</span> {r.huesped.apellidos}
              </Link>
              <div
                className="relative border-b border-linea/70"
                style={{ gridColumn: `2 / span ${dias.length}` }}
              >
                {fin > ini && (
                  <Link
                    to={`/panel/reservas/${r.id}`}
                    title={`${r.codigo}: ${ETIQUETA_ESTADO[r.estado]}`}
                    className={cx(
                      'absolute top-1 bottom-1 rounded px-1 text-xs leading-6 truncate',
                      provisional
                        ? 'bg-ocre-claro text-ocre-texto ring-1 ring-ocre/50 rayado'
                        : 'bg-porton text-cal',
                    )}
                    style={{ left: `${ini * 2}rem`, width: `${(fin - ini) * 2}rem` }}
                  >
                    {r.cantidadHuespedes}p
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t border-linea px-3 py-2 text-sm text-piedra">
        Barras verdes: confirmadas o en alojamiento. Barras ocres rayadas: solicitudes sin
        confirmar. Cada columna es una noche.
      </p>
    </div>
  );
}

export default function Reservas() {
  useTitulo('Reservas');
  const puedeGestionar = usePermiso('reservas:gestionar');
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'calendario' ? 'calendario' : 'lista';
  const estados = params.getAll('estado') as EstadoReserva[];
  const q = params.get('q') ?? '';
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';
  const pagina = Number(params.get('pagina') ?? '1');
  const mes = params.get('mes') ?? inicioDeMes(hoyEnHotel());
  const [busqueda, setBusqueda] = useState(q);

  const actualizar = (cambios: Record<string, string | string[] | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      p.delete(k);
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else if (v) p.set(k, v);
    }
    if (!('pagina' in cambios)) p.delete('pagina');
    setParams(p, { replace: true });
  };

  const filtros =
    vista === 'calendario'
      ? {
          q: q || undefined,
          estado: estados.length ? estados : undefined,
          desde: mes,
          hasta: sumarMeses(mes, 1),
          porPagina: 100,
        }
      : {
          q: q || undefined,
          estado: estados.length ? estados : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
          orden: (params.get('orden') as 'entrada' | 'creacion' | null) ?? undefined,
          pagina,
          porPagina: 25,
        };

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['reservas', filtros],
    queryFn: () => admin.reservas(filtros),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <Encabezado
        titulo="Reservas"
        descripcion="Solicitudes del sitio y reservas registradas por el personal."
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

      <div className="mb-4 flex flex-col gap-4 rounded-lg bg-white p-4 ring-1 ring-linea">
        <form
          role="search"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            actualizar({ q: busqueda.trim() || null });
          }}
        >
          <div className="min-w-[16rem] flex-1">
            <Campo
              etiqueta="Buscar por nombre, teléfono, correo o código"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. Pérez, 300 123 o HR-00012"
            />
          </div>
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
          {vista === 'lista' && (
            <>
              <div className="w-40">
                <Campo
                  etiqueta="Desde"
                  type="date"
                  value={desde}
                  onChange={(e) => actualizar({ desde: e.target.value || null })}
                />
              </div>
              <div className="w-40">
                <Campo
                  etiqueta="Hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => actualizar({ hasta: e.target.value || null })}
                />
              </div>
            </>
          )}
        </form>
        <fieldset>
          <legend className="text-sm font-semibold">Estado</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ESTADOS.map((e) => {
              const activo = estados.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    actualizar({
                      estado: activo ? estados.filter((x) => x !== e) : [...estados, e],
                    })
                  }
                  className={cx(
                    'min-h-9 rounded-full px-3 text-sm ring-1 ring-inset',
                    activo
                      ? 'bg-hierro text-cal ring-hierro'
                      : 'bg-white text-hierro-2 ring-linea hover:bg-cal-2',
                  )}
                >
                  {ETIQUETA_ESTADO[e]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista" className="inline-flex rounded-md bg-cal-2 p-1">
          {(['lista', 'calendario'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={vista === v}
              onClick={() => actualizar({ vista: v === 'lista' ? null : v })}
              className={cx(
                'min-h-9 rounded px-4 text-sm font-semibold',
                vista === v ? 'bg-white shadow-sm' : 'text-piedra',
              )}
            >
              {v === 'lista' ? 'Lista' : 'Calendario'}
            </button>
          ))}
        </div>
        {vista === 'calendario' && (
          <div className="flex items-center gap-2">
            <Boton
              variante="secundario"
              onClick={() => actualizar({ mes: sumarMeses(mes, -1) })}
              aria-label="Mes anterior"
            >
              ‹
            </Boton>
            <p className="min-w-40 text-center font-semibold" aria-live="polite">
              {nombreMes(mes)}
            </p>
            <Boton
              variante="secundario"
              onClick={() => actualizar({ mes: sumarMeses(mes, 1) })}
              aria-label="Mes siguiente"
            >
              ›
            </Boton>
          </div>
        )}
        {vista === 'lista' && data && (
          <p className="text-sm text-piedra">
            {data.total} resultado(s){isFetching ? '…' : ''}
          </p>
        )}
      </div>

      {isLoading && <Cargando />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      {data &&
        (vista === 'calendario' ? (
          <Calendario mes={mes} reservas={data.reservas} />
        ) : data.reservas.length === 0 ? (
          <Vacio titulo="No hay reservas con esos filtros">
            Prueba con otra búsqueda o quita filtros.
          </Vacio>
        ) : (
          <>
            <Lista reservas={data.reservas} />
            <Paginacion
              pagina={data.pagina}
              total={data.total}
              porPagina={data.porPagina}
              onCambiar={(p) => actualizar({ pagina: String(p) })}
            />
          </>
        ))}
      {vista === 'calendario' && data && data.total > data.reservas.length && (
        <p className="mt-2 text-sm text-piedra">
          Se muestran las primeras {data.reservas.length} de {data.total}. Usa la búsqueda para
          acotar.
        </p>
      )}
    </>
  );
}
