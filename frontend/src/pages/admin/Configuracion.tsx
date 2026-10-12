import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { ApiError, mensajeDeError } from '../../api/errors';
import type { Ajuste, Canal, ClaveAjuste, TipoHabitacion } from '../../api/tipos';
import { Encabezado, Panel } from '../../components/admin/comunes';
import { AreaTexto, Aviso, Boton, Campo, Cargando, Casilla, cx } from '../../components/ui';
import { momento } from '../../lib/fechas';
import { useTitulo } from '../../hooks/useSesion';

interface DefCampo {
  k: string;
  l: string;
  largo?: boolean;
  ayuda?: string;
  tipo?: string;
}

// Campos de cada dato del hotel (deben coincidir con backend/src/schemas/ajustes.schema.ts)
const CAMPOS: Record<Exclude<ClaveAjuste, 'tarifas'>, DefCampo[]> = {
  contacto: [
    { k: 'telefono', l: 'Teléfono', tipo: 'tel' },
    { k: 'whatsapp', l: 'WhatsApp', ayuda: 'Con indicativo, ej. 57 300 123 4567' },
    { k: 'email', l: 'Correo', tipo: 'email' },
    { k: 'direccion', l: 'Dirección' },
    { k: 'ciudad', l: 'Ciudad' },
    { k: 'mapaUrl', l: 'Enlace del mapa', ayuda: 'https://…' },
    { k: 'instagram', l: 'Instagram', ayuda: 'https://instagram.com/…' },
    { k: 'facebook', l: 'Facebook', ayuda: 'https://facebook.com/…' },
  ],
  horarios: [
    { k: 'entrada', l: 'Hora de entrada (check-in)', tipo: 'time' },
    { k: 'salida', l: 'Hora de salida (check-out)', tipo: 'time' },
    { k: 'notas', l: 'Notas', largo: true },
  ],
  servicio_desayuno: [
    { k: 'descripcion', l: 'Descripción', largo: true },
    { k: 'horario', l: 'Horario' },
    { k: 'condiciones', l: 'Condiciones', largo: true },
  ],
  servicio_parqueadero: [
    { k: 'descripcion', l: 'Descripción', largo: true },
    { k: 'horario', l: 'Horario' },
    { k: 'condiciones', l: 'Condiciones', largo: true },
  ],
  servicio_wifi: [
    { k: 'descripcion', l: 'Descripción', largo: true },
    { k: 'horario', l: 'Horario' },
    { k: 'condiciones', l: 'Condiciones', largo: true },
  ],
  restaurante: [
    { k: 'descripcion', l: 'Descripción', largo: true },
    { k: 'horario', l: 'Horario' },
  ],
  politicas: [
    { k: 'cancelacion', l: 'Cancelación', largo: true },
    { k: 'anticipos', l: 'Anticipos', largo: true },
    { k: 'noPresentacion', l: 'No presentación', largo: true },
    { k: 'cambios', l: 'Cambios de fecha', largo: true },
    { k: 'grupos', l: 'Grupos', largo: true },
    { k: 'menores', l: 'Menores de edad', largo: true },
    { k: 'mascotas', l: 'Mascotas', largo: true },
    { k: 'huespedesAdicionales', l: 'Huéspedes adicionales', largo: true },
  ],
  tratamiento_datos: [
    { k: 'responsable', l: 'Responsable (razón social)' },
    { k: 'nit', l: 'NIT' },
    { k: 'correoContacto', l: 'Correo para solicitudes de datos', tipo: 'email' },
    { k: 'politicaUrl', l: 'Enlace a la política completa', ayuda: 'https://…' },
    { k: 'version', l: 'Versión de la política' },
  ],
};

function EditorAjuste({ ajuste }: { ajuste: Ajuste }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState<Record<string, unknown>>(ajuste.valor);
  const [confirmado, setConfirmado] = useState(ajuste.confirmado);
  const [publicado, setPublicado] = useState(ajuste.publicado);
  const guardar = useMutation({
    mutationFn: () =>
      admin.guardarAjuste(ajuste.clave, { valor, confirmado, publicado: confirmado && publicado }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ajustes'] }),
  });
  const errores = guardar.error instanceof ApiError ? guardar.error.erroresPorCampo() : {};
  const items = (valor.items as Array<{ concepto: string; valor: string }> | undefined) ?? [];

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        guardar.mutate();
      }}
      className="flex flex-col gap-4"
    >
      {ajuste.clave === 'tarifas' ? (
        <>
          <Aviso tono="pendiente">
            Las tarifas son solo informativas: el sistema no calcula ni cobra precios. Publícalas
            únicamente si la administración las confirmó.
          </Aviso>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Vigencia"
              value={String(valor.vigencia ?? '')}
              onChange={(e) => setValor({ ...valor, vigencia: e.target.value })}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_12rem_auto]">
                <Campo
                  etiqueta="Concepto"
                  value={it.concepto}
                  onChange={(e) =>
                    setValor({
                      ...valor,
                      items: items.map((x, j) =>
                        j === i ? { ...x, concepto: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Campo
                  etiqueta="Valor"
                  value={it.valor}
                  onChange={(e) =>
                    setValor({
                      ...valor,
                      items: items.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)),
                    })
                  }
                />
                <Boton
                  variante="sutil"
                  onClick={() => setValor({ ...valor, items: items.filter((_, j) => j !== i) })}
                >
                  Quitar
                </Boton>
              </li>
            ))}
          </ul>
          <div>
            <Boton
              variante="secundario"
              onClick={() => setValor({ ...valor, items: [...items, { concepto: '', valor: '' }] })}
            >
              Agregar tarifa
            </Boton>
          </div>
          <AreaTexto
            etiqueta="Notas"
            value={String(valor.notas ?? '')}
            onChange={(e) => setValor({ ...valor, notas: e.target.value })}
          />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS[ajuste.clave].map((c) =>
            c.largo ? (
              <div key={c.k} className="sm:col-span-2">
                <AreaTexto
                  etiqueta={c.l}
                  value={String(valor[c.k] ?? '')}
                  onChange={(e) => setValor({ ...valor, [c.k]: e.target.value })}
                  error={errores[c.k]}
                  ayuda={c.ayuda}
                />
              </div>
            ) : (
              <Campo
                key={c.k}
                etiqueta={c.l}
                type={c.tipo ?? 'text'}
                value={String(valor[c.k] ?? '')}
                onChange={(e) => setValor({ ...valor, [c.k]: e.target.value })}
                error={errores[c.k]}
                ayuda={c.ayuda}
              />
            ),
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-md bg-cal-2 p-3">
        <Casilla
          etiqueta="La administración del hotel confirmó estos datos"
          checked={confirmado}
          onChange={(e) => {
            setConfirmado(e.target.checked);
            if (!e.target.checked) setPublicado(false);
          }}
        />
        <Casilla
          etiqueta="Mostrar en el sitio público"
          checked={publicado}
          disabled={!confirmado}
          onChange={(e) => setPublicado(e.target.checked)}
        />
      </div>
      {guardar.isError && <Aviso tono="error">{mensajeDeError(guardar.error)}</Aviso>}
      {guardar.isSuccess && <Aviso tono="exito">Guardado.</Aviso>}
      <div>
        <Boton type="submit" cargando={guardar.isPending}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}

function Tipos() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['tipos'], queryFn: admin.tiposHabitacion });
  const [nombre, setNombre] = useState('');
  const crear = useMutation({
    mutationFn: () => admin.crearTipo({ nombre: nombre.trim(), publicado: false }),
    onSuccess: () => {
      setNombre('');
      void qc.invalidateQueries({ queryKey: ['tipos'] });
    },
  });
  const editar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TipoHabitacion> }) =>
      admin.editarTipo(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tipos'] }),
  });
  return (
    <Panel titulo="Tipos de habitación">
      <p className="mb-3 text-sm text-piedra">
        Los publicados aparecen en el sitio y en el formulario de solicitud.
      </p>
      <ul className="divide-y divide-linea">
        {data?.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className={cx(!t.activo && 'text-piedra line-through')}>
              {t.nombre}{' '}
              <span className="text-sm text-piedra">({t._count?.habitaciones ?? 0} hab.)</span>
            </span>
            <span className="flex flex-wrap gap-4">
              <Casilla
                etiqueta="Publicado"
                checked={t.publicado}
                onChange={(e) => editar.mutate({ id: t.id, body: { publicado: e.target.checked } })}
              />
              <Casilla
                etiqueta="Activo"
                checked={t.activo}
                onChange={(e) => editar.mutate({ id: t.id, body: { activo: e.target.checked } })}
              />
            </span>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          crear.mutate();
        }}
      >
        <div className="flex-1">
          <Campo etiqueta="Nuevo tipo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <Boton
          type="submit"
          variante="secundario"
          disabled={nombre.trim().length < 2}
          cargando={crear.isPending}
        >
          Agregar
        </Boton>
      </form>
      {(crear.isError || editar.isError) && (
        <div className="mt-2">
          <Aviso tono="error">{mensajeDeError(crear.error ?? editar.error)}</Aviso>
        </div>
      )}
    </Panel>
  );
}

function Canales() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['canales'], queryFn: admin.canales });
  const [f, setF] = useState({ codigo: '', nombre: '' });
  const crear = useMutation({
    mutationFn: () => admin.crearCanal({ codigo: f.codigo.trim(), nombre: f.nombre.trim() }),
    onSuccess: () => {
      setF({ codigo: '', nombre: '' });
      void qc.invalidateQueries({ queryKey: ['canales'] });
    },
  });
  const editar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Canal> }) => admin.editarCanal(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['canales'] }),
  });
  return (
    <Panel titulo="Canales de origen de las reservas">
      <ul className="divide-y divide-linea">
        {data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              {c.nombre} <span className="text-sm text-piedra">({c.codigo})</span>
            </span>
            <Casilla
              etiqueta="Activo"
              checked={c.activo}
              disabled={c.codigo === 'web'}
              onChange={(e) => editar.mutate({ id: c.id, body: { activo: e.target.checked } })}
            />
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          crear.mutate();
        }}
      >
        <Campo
          etiqueta="Código"
          value={f.codigo}
          onChange={(e) => setF({ ...f, codigo: e.target.value })}
          ayuda="Minúsculas, ej. booking"
        />
        <Campo
          etiqueta="Nombre"
          value={f.nombre}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
        />
        <Boton type="submit" variante="secundario" cargando={crear.isPending}>
          Agregar
        </Boton>
      </form>
      {(crear.isError || editar.isError) && (
        <div className="mt-2">
          <Aviso tono="error">{mensajeDeError(crear.error ?? editar.error)}</Aviso>
        </div>
      )}
    </Panel>
  );
}

export default function Configuracion() {
  useTitulo('Datos del hotel');
  const { data, isLoading, error } = useQuery({ queryKey: ['ajustes'], queryFn: admin.ajustes });
  const [abierto, setAbierto] = useState<ClaveAjuste | null>(null);
  return (
    <>
      <Encabezado
        titulo="Datos del hotel"
        descripcion="Nada de esto aparece en el sitio hasta que lo marques como confirmado por la administración y elijas mostrarlo."
      />
      {isLoading && <Cargando />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <ul className="mb-6 flex flex-col gap-3">
        {data?.map((a) => (
          <li key={a.clave} className="rounded-lg bg-white ring-1 ring-linea">
            <button
              type="button"
              aria-expanded={abierto === a.clave}
              onClick={() => setAbierto(abierto === a.clave ? null : a.clave)}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="font-semibold">{a.etiqueta}</span>
              <span
                className={cx(
                  'rounded-full px-2.5 py-0.5 text-sm',
                  a.publicado
                    ? 'bg-porton-claro text-porton-2'
                    : a.confirmado
                      ? 'bg-cal-2 text-hierro-2'
                      : 'bg-ocre-claro text-ocre-texto',
                )}
              >
                {a.publicado
                  ? 'Publicado'
                  : a.confirmado
                    ? 'Confirmado, sin publicar'
                    : 'Por confirmar'}
              </span>
            </button>
            {abierto === a.clave && (
              <div className="border-t border-linea px-4 py-4">
                {a.updatedAt && (
                  <p className="mb-3 text-sm text-piedra">
                    Última edición: {momento(a.updatedAt)}
                    {a.actualizadoPor ? `, ${a.actualizadoPor.nombre}` : ''}
                  </p>
                )}
                <EditorAjuste ajuste={a} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="grid gap-5 lg:grid-cols-2">
        <Tipos />
        <Canales />
      </div>
    </>
  );
}
