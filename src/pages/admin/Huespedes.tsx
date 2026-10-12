import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { ApiError, mensajeDeError } from '../../api/errors';
import type { HuespedDetalle } from '../../api/tipos';
import { Encabezado, Panel } from '../../components/admin/comunes';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Dialogo,
  InsigniaEstado,
  Paginacion,
  Selector,
  Vacio,
} from '../../components/ui';
import { ETIQUETA_DOCUMENTO } from '../../lib/estados';
import { fechaCorta, momento } from '../../lib/fechas';
import { usePermiso, useTitulo } from '../../hooks/useSesion';

function descargarJson(nombre: string, datos: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function Ficha({ h, onCerrar }: { h: HuespedDetalle; onCerrar: () => void }) {
  const qc = useQueryClient();
  const editar = usePermiso('reservas:gestionar');
  const derechos = usePermiso('huespedes:gestionar_datos');
  const verDocumento = usePermiso('huespedes:ver_documento');
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({
    nombres: h.nombres,
    apellidos: h.apellidos,
    telefono: h.datosRestringidos ? '' : (h.telefono ?? ''),
    email: h.datosRestringidos ? '' : (h.email ?? ''),
    tipoDocumento: h.tipoDocumento ?? '',
    numeroDocumento: verDocumento ? (h.numeroDocumento ?? '') : '',
  });
  const guardar = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
      };
      // Solo se envían los datos que la persona puede ver completos (no se sobrescriben con "•••")
      if (!h.datosRestringidos || f.telefono) body.telefono = f.telefono.trim() || null;
      if (!h.datosRestringidos || f.email) body.email = f.email.trim() || null;
      if (verDocumento || f.numeroDocumento) {
        body.tipoDocumento = f.tipoDocumento || null;
        body.numeroDocumento = f.numeroDocumento.trim() || null;
      }
      return admin.editarHuesped(h.id, body);
    },
    onSuccess: () => {
      setEditando(false);
      void qc.invalidateQueries();
    },
  });
  const exportar = useMutation({
    mutationFn: () => admin.exportarHuesped(h.id),
    onSuccess: (d) => descargarJson(`datos-huesped-${h.id.slice(0, 8)}.json`, d),
  });
  const anonimizar = useMutation({
    mutationFn: () => admin.anonimizarHuesped(h.id),
    onSuccess: () => {
      void qc.invalidateQueries();
      onCerrar();
    },
  });
  const e = guardar.error instanceof ApiError ? guardar.error.erroresPorCampo() : {};

  return (
    <div className="flex flex-col gap-5">
      {h.anonimizado && (
        <Aviso tono="pendiente">Los datos personales de este titular fueron suprimidos.</Aviso>
      )}
      {!editando ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-piedra">Teléfono</dt>
          <dd>{h.telefono ?? '—'}</dd>
          <dt className="text-piedra">Correo</dt>
          <dd className="break-all">{h.email ?? '—'}</dd>
          <dt className="text-piedra">Documento</dt>
          <dd>
            {h.tipoDocumento
              ? `${ETIQUETA_DOCUMENTO[h.tipoDocumento]} ${h.numeroDocumento ?? ''}`
              : '—'}
          </dd>
          <dt className="text-piedra">Autorización de datos</dt>
          <dd>
            {h.consentimientoEn
              ? `${momento(h.consentimientoEn)} (versión ${h.versionPolitica ?? '—'})`
              : 'Registrado por el personal'}
          </dd>
        </dl>
      ) : (
        <form
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            guardar.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Campo
            etiqueta="Nombres"
            value={f.nombres}
            onChange={(x) => setF({ ...f, nombres: x.target.value })}
            error={e.nombres}
          />
          <Campo
            etiqueta="Apellidos"
            value={f.apellidos}
            onChange={(x) => setF({ ...f, apellidos: x.target.value })}
            error={e.apellidos}
          />
          <Campo
            etiqueta="Teléfono"
            value={f.telefono}
            placeholder={h.datosRestringidos ? 'Oculto: escribe uno nuevo para cambiarlo' : ''}
            onChange={(x) => setF({ ...f, telefono: x.target.value })}
            error={e.telefono}
          />
          <Campo
            etiqueta="Correo"
            value={f.email}
            placeholder={h.datosRestringidos ? 'Oculto: escribe uno nuevo para cambiarlo' : ''}
            onChange={(x) => setF({ ...f, email: x.target.value })}
            error={e.email}
          />
          <Selector
            etiqueta="Tipo de documento"
            value={f.tipoDocumento}
            onChange={(x) => setF({ ...f, tipoDocumento: x.target.value })}
          >
            <option value="">Sin documento</option>
            {Object.entries(ETIQUETA_DOCUMENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Campo
            etiqueta="Número de documento"
            value={f.numeroDocumento}
            placeholder={verDocumento ? '' : 'Oculto: escribe uno nuevo para cambiarlo'}
            onChange={(x) => setF({ ...f, numeroDocumento: x.target.value })}
            error={e.numeroDocumento}
          />
          {guardar.isError && (
            <div className="sm:col-span-2">
              <Aviso tono="error">{mensajeDeError(guardar.error)}</Aviso>
            </div>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <Boton type="submit" cargando={guardar.isPending}>
              Guardar
            </Boton>
            <Boton variante="secundario" onClick={() => setEditando(false)}>
              Volver
            </Boton>
          </div>
        </form>
      )}
      <div>
        <h3 className="font-sans text-base font-semibold">Reservas</h3>
        <ul className="mt-2 divide-y divide-linea">
          {h.reservas.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link
                to={`/panel/reservas/${r.id}`}
                className="text-porton underline-offset-4 hover:underline"
              >
                {r.codigo}: {fechaCorta(r.fechaEntrada)} – {fechaCorta(r.fechaSalida)}
              </Link>
              <InsigniaEstado estado={r.estado} />
            </li>
          ))}
        </ul>
      </div>
      {!h.anonimizado && (
        <div className="flex flex-wrap gap-2 border-t border-linea pt-4">
          {editar && !editando && (
            <Boton variante="secundario" onClick={() => setEditando(true)}>
              Corregir datos
            </Boton>
          )}
          {derechos && (
            <Boton
              variante="secundario"
              cargando={exportar.isPending}
              onClick={() => exportar.mutate()}
            >
              Exportar sus datos
            </Boton>
          )}
          {derechos && (
            <Boton
              variante="peligro"
              cargando={anonimizar.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    '¿Suprimir los datos personales de este titular? No se puede deshacer.',
                  )
                )
                  anonimizar.mutate();
              }}
            >
              Suprimir sus datos
            </Boton>
          )}
        </div>
      )}
      {(exportar.isError || anonimizar.isError) && (
        <Aviso tono="error">{mensajeDeError(exportar.error ?? anonimizar.error)}</Aviso>
      )}
    </div>
  );
}

export default function Huespedes() {
  useTitulo('Huéspedes');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const pagina = Number(params.get('pagina') ?? '1');
  const seleccionado = params.get('id');
  const [busqueda, setBusqueda] = useState(q);
  const lista = useQuery({
    queryKey: ['huespedes', q, pagina],
    queryFn: () => admin.huespedes({ q: q || undefined, pagina }),
    placeholderData: keepPreviousData,
  });
  const ficha = useQuery({
    queryKey: ['huesped', seleccionado],
    queryFn: () => admin.huesped(seleccionado!),
    enabled: Boolean(seleccionado),
  });
  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('id', id);
    else p.delete('id');
    setParams(p, { replace: true });
  };

  return (
    <>
      <Encabezado
        titulo="Huéspedes"
        descripcion="Datos mínimos para gestionar las estadías. Lo que ves depende de tus permisos."
      />
      <form
        role="search"
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(busqueda.trim() ? { q: busqueda.trim() } : {}, { replace: true });
        }}
      >
        <div className="min-w-[16rem] flex-1">
          <Campo
            etiqueta="Buscar por nombre, teléfono o correo"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>
      {lista.isLoading && <Cargando />}
      {lista.error && <Aviso tono="error">{mensajeDeError(lista.error)}</Aviso>}
      {lista.data && lista.data.huespedes.length === 0 && (
        <Vacio titulo="No hay huéspedes con esa búsqueda" />
      )}
      {lista.data && lista.data.huespedes.length > 0 && (
        <Panel>
          <ul className="divide-y divide-linea">
            {lista.data.huespedes.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => abrir(h.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-1 py-2.5 text-left hover:bg-cal"
                >
                  <span>
                    <strong>
                      {h.nombres} {h.apellidos}
                    </strong>
                    <span className="block text-sm text-piedra">
                      {[h.telefono, h.email].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <span className="text-sm text-piedra">{h.reservas} reserva(s)</span>
                </button>
              </li>
            ))}
          </ul>
          <Paginacion
            pagina={lista.data.pagina}
            total={lista.data.total}
            porPagina={lista.data.porPagina}
            onCambiar={(p) => setParams({ ...(q ? { q } : {}), pagina: String(p) })}
          />
        </Panel>
      )}
      <Dialogo
        abierto={Boolean(seleccionado)}
        titulo={ficha.data ? `${ficha.data.nombres} ${ficha.data.apellidos}` : 'Huésped'}
        onCerrar={() => abrir(null)}
        ancho="max-w-2xl"
      >
        {ficha.isLoading && <Cargando />}
        {ficha.error && <Aviso tono="error">{mensajeDeError(ficha.error)}</Aviso>}
        {ficha.data && <Ficha key={ficha.data.id} h={ficha.data} onCerrar={() => abrir(null)} />}
      </Dialogo>
    </>
  );
}
