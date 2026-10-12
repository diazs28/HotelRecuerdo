import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { ApiError, esApiError, mensajeDeError } from '../../api/errors';
import type { Cama, Habitacion, TipoCama } from '../../api/tipos';
import { Encabezado, Panel } from '../../components/admin/comunes';
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Casilla,
  Dialogo,
  Selector,
  Vacio,
} from '../../components/ui';
import { ETIQUETA_TIPO_CAMA, TIPOS_CAMA } from '../../lib/estados';
import { fechaCorta, hoyEnHotel, sumarDias } from '../../lib/fechas';
import { usePermiso, useTitulo } from '../../hooks/useSesion';

type Modal =
  | { tipo: 'habitacion'; habitacion?: Habitacion }
  | { tipo: 'cama'; habitacion: Habitacion; cama?: Cama }
  | { tipo: 'bloqueo'; habitacion: Habitacion; camaId?: string };

function errores(e: unknown) {
  return e instanceof ApiError ? e.erroresPorCampo() : {};
}

function ErrorApi({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Aviso tono="error">
      {mensajeDeError(error)}
      {esApiError(error) && error.code === 'CAMA_NO_DISPONIBLE' && (
        <ul className="mt-2 list-disc pl-5">
          {error.details.map((d) => (
            <li key={d.message}>{d.message}</li>
          ))}
        </ul>
      )}
    </Aviso>
  );
}

function FormHabitacion({ habitacion, onListo }: { habitacion?: Habitacion; onListo: () => void }) {
  const qc = useQueryClient();
  const tipos = useQuery({ queryKey: ['tipos'], queryFn: admin.tiposHabitacion });
  const [f, setF] = useState({
    numero: habitacion?.numero ?? '',
    tipoHabitacionId: habitacion?.tipoHabitacion.id ?? '',
    capacidad: String(habitacion?.capacidad ?? 2),
    piso: habitacion?.piso ?? '',
    descripcion: habitacion?.descripcion ?? '',
    camas: '2',
    tipoCama: 'SENCILLA' as TipoCama,
  });
  const guardar = useMutation({
    mutationFn: () => {
      const base = {
        numero: f.numero.trim(),
        tipoHabitacionId: f.tipoHabitacionId,
        capacidad: Number(f.capacidad),
        piso: f.piso.trim() || null,
        descripcion: f.descripcion.trim() || null,
      };
      if (habitacion) return admin.editarHabitacion(habitacion.id, base);
      const n = Math.max(0, Math.min(20, Number(f.camas) || 0));
      return admin.crearHabitacion({
        ...base,
        camas: Array.from({ length: n }, (_, i) => ({
          identificador: String.fromCharCode(65 + i),
          tipo: f.tipoCama,
          plazas: 1,
        })),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      onListo();
    },
  });
  const e = errores(guardar.error);
  return (
    <form
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        guardar.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Número o nombre"
          required
          value={f.numero}
          onChange={(x) => setF({ ...f, numero: x.target.value })}
          error={e.numero}
        />
        <Selector
          etiqueta="Tipo"
          required
          value={f.tipoHabitacionId}
          onChange={(x) => setF({ ...f, tipoHabitacionId: x.target.value })}
          error={e.tipoHabitacionId}
        >
          <option value="">Selecciona…</option>
          {tipos.data
            ?.filter((t) => t.activo)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
        </Selector>
        <Campo
          etiqueta="Capacidad (personas)"
          type="number"
          min={1}
          max={50}
          required
          value={f.capacidad}
          onChange={(x) => setF({ ...f, capacidad: x.target.value })}
          error={e.capacidad}
        />
        <Campo
          etiqueta="Piso"
          value={f.piso}
          onChange={(x) => setF({ ...f, piso: x.target.value })}
        />
      </div>
      {!habitacion && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Camas iniciales"
            type="number"
            min={0}
            max={20}
            value={f.camas}
            onChange={(x) => setF({ ...f, camas: x.target.value })}
            ayuda="Se crean como A, B, C… Luego puedes editarlas."
          />
          <Selector
            etiqueta="Tipo de esas camas"
            value={f.tipoCama}
            onChange={(x) => setF({ ...f, tipoCama: x.target.value as TipoCama })}
          >
            {TIPOS_CAMA.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_CAMA[t]}
              </option>
            ))}
          </Selector>
        </div>
      )}
      <AreaTexto
        etiqueta="Descripción interna"
        value={f.descripcion}
        onChange={(x) => setF({ ...f, descripcion: x.target.value })}
        maxLength={500}
      />
      <ErrorApi error={guardar.error} />
      <div className="flex gap-3">
        <Boton type="submit" cargando={guardar.isPending}>
          {habitacion ? 'Guardar cambios' : 'Crear habitación'}
        </Boton>
        <Boton variante="secundario" onClick={onListo}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

function FormCama({
  habitacion,
  cama,
  onListo,
}: {
  habitacion: Habitacion;
  cama?: Cama;
  onListo: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    identificador: cama?.identificador ?? '',
    tipo: cama?.tipo ?? ('SENCILLA' as TipoCama),
    plazas: String(cama?.plazas ?? 1),
  });
  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        identificador: f.identificador.trim(),
        tipo: f.tipo,
        plazas: Number(f.plazas),
      };
      return cama
        ? admin.editarCama(habitacion.id, cama.id, body)
        : admin.crearCama(habitacion.id, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      onListo();
    },
  });
  const retirar = useMutation({
    mutationFn: () => admin.editarCama(habitacion.id, cama!.id, { activa: false }),
    onSuccess: () => {
      void qc.invalidateQueries();
      onListo();
    },
  });
  const e = errores(guardar.error);
  return (
    <form
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        guardar.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          etiqueta="Identificador"
          required
          value={f.identificador}
          onChange={(x) => setF({ ...f, identificador: x.target.value })}
          error={e.identificador}
        />
        <Selector
          etiqueta="Tipo de cama"
          value={f.tipo}
          onChange={(x) => setF({ ...f, tipo: x.target.value as TipoCama })}
        >
          {TIPOS_CAMA.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_CAMA[t]}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta="Plazas (personas)"
          type="number"
          min={1}
          max={4}
          value={f.plazas}
          onChange={(x) => setF({ ...f, plazas: x.target.value })}
          error={e.plazas}
        />
      </div>
      <ErrorApi error={guardar.error ?? retirar.error} />
      <div className="flex flex-wrap gap-3">
        <Boton type="submit" cargando={guardar.isPending}>
          {cama ? 'Guardar cama' : 'Agregar cama'}
        </Boton>
        {cama && (
          <Boton variante="peligro" cargando={retirar.isPending} onClick={() => retirar.mutate()}>
            Retirar cama
          </Boton>
        )}
        <Boton variante="secundario" onClick={onListo}>
          Volver
        </Boton>
      </div>
      {cama && (
        <p className="text-sm text-piedra">
          Retirar una cama la saca del inventario sin borrar su historial. No se puede si tiene
          reservas vigentes o futuras.
        </p>
      )}
    </form>
  );
}

function FormBloqueo({
  habitacion,
  camaId,
  onListo,
}: {
  habitacion: Habitacion;
  camaId?: string;
  onListo: () => void;
}) {
  const qc = useQueryClient();
  const hoy = hoyEnHotel();
  const [f, setF] = useState({
    tipo: 'MANTENIMIENTO',
    camaId: camaId ?? '',
    fechaInicio: hoy,
    fechaFin: sumarDias(hoy, 1),
    sinFin: false,
    motivo: '',
  });
  const crear = useMutation({
    mutationFn: () =>
      admin.crearBloqueo({
        tipo: f.tipo,
        habitacionId: habitacion.id,
        camaId: f.camaId || null,
        fechaInicio: f.fechaInicio,
        fechaFin: f.sinFin ? null : f.fechaFin,
        motivo: f.motivo.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries();
      onListo();
    },
  });
  const e = errores(crear.error);
  return (
    <form
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        crear.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Tipo"
          value={f.tipo}
          onChange={(x) => setF({ ...f, tipo: x.target.value })}
        >
          <option value="MANTENIMIENTO">Mantenimiento</option>
          <option value="BLOQUEO">Bloqueo</option>
        </Selector>
        <Selector
          etiqueta="Alcance"
          value={f.camaId}
          onChange={(x) => setF({ ...f, camaId: x.target.value })}
        >
          <option value="">Toda la habitación</option>
          {habitacion.camas
            .filter((c) => c.activa)
            .map((c) => (
              <option key={c.id} value={c.id}>
                Solo la cama {c.identificador}
              </option>
            ))}
        </Selector>
        <Campo
          etiqueta="Desde (primera noche)"
          type="date"
          required
          value={f.fechaInicio}
          onChange={(x) => setF({ ...f, fechaInicio: x.target.value })}
          error={e.fechaInicio}
        />
        <Campo
          etiqueta="Disponible de nuevo el"
          type="date"
          disabled={f.sinFin}
          min={sumarDias(f.fechaInicio, 1)}
          value={f.fechaFin}
          onChange={(x) => setF({ ...f, fechaFin: x.target.value })}
          error={e.fechaFin}
        />
      </div>
      <Casilla
        etiqueta="Sin fecha de fin (se libera manualmente)"
        checked={f.sinFin}
        onChange={(x) => setF({ ...f, sinFin: x.target.checked })}
      />
      <AreaTexto
        etiqueta="Motivo"
        required
        value={f.motivo}
        onChange={(x) => setF({ ...f, motivo: x.target.value })}
        maxLength={300}
        error={e.motivo}
      />
      <ErrorApi error={crear.error} />
      <div className="flex gap-3">
        <Boton type="submit" cargando={crear.isPending} disabled={f.motivo.trim().length < 3}>
          Bloquear
        </Boton>
        <Boton variante="secundario" onClick={onListo}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

export default function Habitaciones() {
  useTitulo('Habitaciones y camas');
  const qc = useQueryClient();
  const gestionar = usePermiso('habitaciones:gestionar');
  const bloquear = usePermiso('bloqueos:gestionar');
  const [inactivas, setInactivas] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['habitaciones', inactivas],
    queryFn: () => admin.habitaciones(inactivas),
  });
  const bloqueos = useQuery({
    queryKey: ['bloqueos'],
    queryFn: () => admin.bloqueos({ vigentes: true }),
  });
  const liberar = useMutation({
    mutationFn: admin.liberarBloqueo,
    onSuccess: () => void qc.invalidateQueries(),
  });
  const reactivar = useMutation({
    mutationFn: (id: string) => admin.editarHabitacion(id, { activa: true }),
    onSuccess: () => void qc.invalidateQueries(),
  });
  const retirar = useMutation({
    mutationFn: (id: string) => admin.editarHabitacion(id, { activa: false }),
    onSuccess: () => void qc.invalidateQueries(),
  });

  const cerrar = () => setModal(null);
  const titulo =
    modal?.tipo === 'habitacion'
      ? modal.habitacion
        ? `Editar habitación ${modal.habitacion.numero}`
        : 'Nueva habitación'
      : modal?.tipo === 'cama'
        ? modal.cama
          ? `Cama ${modal.cama.identificador}, habitación ${modal.habitacion.numero}`
          : `Nueva cama en la habitación ${modal.habitacion.numero}`
        : modal?.tipo === 'bloqueo'
          ? `Bloquear la habitación ${modal.habitacion.numero}`
          : '';

  return (
    <>
      <Encabezado
        titulo="Habitaciones y camas"
        descripcion={
          data
            ? `${data.resumen.habitaciones} habitaciones activas, ${data.resumen.camas} camas y ${data.resumen.plazas} plazas configuradas. La caracterización del hotel registra 20 habitaciones y 37 camas: confirma la distribución real.`
            : undefined
        }
        acciones={
          gestionar && (
            <Boton onClick={() => setModal({ tipo: 'habitacion' })}>Nueva habitación</Boton>
          )
        }
      />

      <Panel titulo="Bloqueos y mantenimientos vigentes" className="mb-5">
        {bloqueos.data?.length ? (
          <ul className="divide-y divide-linea">
            {bloqueos.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{b.tipo === 'MANTENIMIENTO' ? 'Mantenimiento' : 'Bloqueo'}</strong>:
                  habitación {b.habitacion.numero}
                  {b.cama ? `, cama ${b.cama.identificador}` : ' completa'}. Desde el{' '}
                  {fechaCorta(b.fechaInicio)}
                  {b.fechaFin
                    ? `; disponible de nuevo el ${fechaCorta(b.fechaFin)}`
                    : ', sin fecha de fin'}
                  .
                  <span className="block text-sm text-piedra">
                    {b.motivo}. Registró {b.creadoPor.nombre}.
                  </span>
                </span>
                {bloquear && (
                  <Boton
                    variante="secundario"
                    cargando={liberar.isPending && liberar.variables === b.id}
                    onClick={() => liberar.mutate(b.id)}
                  >
                    Liberar desde hoy
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-piedra">No hay bloqueos vigentes.</p>
        )}
        <ErrorApi error={liberar.error} />
      </Panel>

      <div className="mb-3">
        <Casilla
          etiqueta="Mostrar habitaciones retiradas"
          checked={inactivas}
          onChange={(e) => setInactivas(e.target.checked)}
        />
      </div>
      {isLoading && <Cargando />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <ErrorApi error={retirar.error} />
      {data && data.habitaciones.length === 0 && (
        <Vacio titulo="Aún no hay habitaciones">
          Crea la primera habitación con sus camas para empezar a asignar reservas.
        </Vacio>
      )}
      <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data?.habitaciones.map((h) => (
          <li
            key={h.id}
            className={`rounded-lg bg-white p-4 ring-1 ring-linea ${h.activa ? '' : 'opacity-70'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-2xl">{h.numero}</p>
                <p className="text-sm text-piedra">
                  {h.tipoHabitacion.nombre}, hasta {h.capacidad} persona(s)
                  {h.piso ? `, piso ${h.piso}` : ''}
                  {h.activa ? '' : '. Retirada'}
                </p>
              </div>
              {gestionar && h.activa && (
                <Boton
                  variante="sutil"
                  onClick={() => setModal({ tipo: 'habitacion', habitacion: h })}
                >
                  Editar
                </Boton>
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {h.camas
                .filter((c) => c.activa || inactivas)
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={!gestionar || !c.activa}
                      onClick={() => setModal({ tipo: 'cama', habitacion: h, cama: c })}
                      className="min-h-10 rounded-md bg-cal px-3 text-sm ring-1 ring-linea enabled:hover:bg-cal-2 disabled:cursor-default"
                    >
                      Cama {c.identificador}: {ETIQUETA_TIPO_CAMA[c.tipo]}, {c.plazas} plaza(s)
                      {c.activa ? '' : ' (retirada)'}
                    </button>
                  </li>
                ))}
            </ul>
            {h.activa && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-linea pt-3">
                {gestionar && (
                  <Boton variante="sutil" onClick={() => setModal({ tipo: 'cama', habitacion: h })}>
                    Agregar cama
                  </Boton>
                )}
                {bloquear && (
                  <Boton
                    variante="sutil"
                    onClick={() => setModal({ tipo: 'bloqueo', habitacion: h })}
                  >
                    Bloquear o mantenimiento
                  </Boton>
                )}
                {gestionar && (
                  <Boton
                    variante="sutil"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Retirar la habitación ${h.numero} del inventario? Se conserva su historial.`,
                        )
                      )
                        retirar.mutate(h.id);
                    }}
                  >
                    Retirar
                  </Boton>
                )}
              </div>
            )}
            {!h.activa && gestionar && (
              <Boton variante="sutil" className="mt-2" onClick={() => reactivar.mutate(h.id)}>
                Reactivar
              </Boton>
            )}
          </li>
        ))}
      </ul>

      <Dialogo abierto={modal !== null} titulo={titulo} onCerrar={cerrar} ancho="max-w-2xl">
        {modal?.tipo === 'habitacion' && (
          <FormHabitacion habitacion={modal.habitacion} onListo={cerrar} />
        )}
        {modal?.tipo === 'cama' && (
          <FormCama habitacion={modal.habitacion} cama={modal.cama} onListo={cerrar} />
        )}
        {modal?.tipo === 'bloqueo' && (
          <FormBloqueo habitacion={modal.habitacion} camaId={modal.camaId} onListo={cerrar} />
        )}
      </Dialogo>
    </>
  );
}
