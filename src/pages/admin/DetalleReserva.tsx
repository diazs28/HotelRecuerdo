import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { ApiError, esApiError, mensajeDeError } from '../../api/errors';
import type { EstadoReserva, ReservaDetalle } from '../../api/tipos';
import { Encabezado, Panel, nombreHuesped } from '../../components/admin/comunes';
import { SelectorCamas } from '../../components/admin/SelectorCamas';
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Dialogo,
  InsigniaEstado,
} from '../../components/ui';
import {
  ETIQUETA_ACCION,
  ETIQUETA_DOCUMENTO,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO_CAMA,
  accionesDisponibles,
  type Accion,
} from '../../lib/estados';
import { fechaLarga, momento, noches, sumarDias } from '../../lib/fechas';
import { usePermiso, useTitulo } from '../../hooks/useSesion';

function ErrorConDetalle({ error }: { error: unknown }) {
  return (
    <Aviso tono="error">
      {mensajeDeError(error)}
      {esApiError(error) && error.code === 'CAMA_NO_DISPONIBLE' && error.details.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {error.details.map((d) => (
            <li key={d.message}>{d.message}</li>
          ))}
        </ul>
      )}
    </Aviso>
  );
}

function describirCambio(datos: Record<string, unknown> | null): string {
  if (!datos) return '';
  const partes: string[] = [];
  if (typeof datos.de === 'string' && typeof datos.a === 'string') {
    partes.push(
      `${ETIQUETA_ESTADO[datos.de as EstadoReserva] ?? datos.de} → ${ETIQUETA_ESTADO[datos.a as EstadoReserva] ?? datos.a}`,
    );
  }
  if (typeof datos.motivo === 'string') partes.push(`Motivo: ${datos.motivo}`);
  if (Array.isArray(datos.fechasDespues))
    partes.push(`Nuevas fechas: ${datos.fechasDespues.join(' a ')}`);
  if (typeof datos.salidaAnticipada === 'string')
    partes.push(`Salida anticipada el ${datos.salidaAnticipada}`);
  if (Array.isArray(datos.camaIds)) partes.push(`${datos.camaIds.length} cama(s)`);
  if (typeof datos.camasLiberadas === 'number' && datos.camasLiberadas > 0)
    partes.push(`${datos.camasLiberadas} cama(s) liberadas`);
  return partes.join('. ');
}

function Editar({ r, onListo }: { r: ReservaDetalle; onListo: () => void }) {
  const qc = useQueryClient();
  const editable = ['SOLICITUD', 'PENDIENTE_CONFIRMACION', 'CONFIRMADA'].includes(r.estado);
  const enAlojamiento = r.estado === 'EN_ALOJAMIENTO';
  const [f, setF] = useState({
    fechaEntrada: r.fechaEntrada,
    fechaSalida: r.fechaSalida,
    cantidadHuespedes: String(r.cantidadHuespedes),
    notasOperativas: r.notasOperativas ?? '',
  });
  const guardar = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { notasOperativas: f.notasOperativas.trim() || null };
      if (editable || enAlojamiento) {
        if (f.fechaSalida !== r.fechaSalida) body.fechaSalida = f.fechaSalida;
        if (Number(f.cantidadHuespedes) !== r.cantidadHuespedes)
          body.cantidadHuespedes = Number(f.cantidadHuespedes);
      }
      if (editable && f.fechaEntrada !== r.fechaEntrada) body.fechaEntrada = f.fechaEntrada;
      return admin.editarReserva(r.id, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      onListo();
    },
  });
  const errores = guardar.error instanceof ApiError ? guardar.error.erroresPorCampo() : {};
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        guardar.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          etiqueta="Entrada"
          type="date"
          disabled={!editable}
          value={f.fechaEntrada}
          onChange={(e) => setF({ ...f, fechaEntrada: e.target.value })}
          error={errores.fechaEntrada}
        />
        <Campo
          etiqueta="Salida"
          type="date"
          disabled={!editable && !enAlojamiento}
          min={sumarDias(f.fechaEntrada, 1)}
          value={f.fechaSalida}
          onChange={(e) => setF({ ...f, fechaSalida: e.target.value })}
          error={errores.fechaSalida}
        />
        <Campo
          etiqueta="Huéspedes"
          type="number"
          min={1}
          disabled={!editable && !enAlojamiento}
          value={f.cantidadHuespedes}
          onChange={(e) => setF({ ...f, cantidadHuespedes: e.target.value })}
          error={errores.cantidadHuespedes}
        />
      </div>
      <AreaTexto
        etiqueta="Notas operativas"
        value={f.notasOperativas}
        onChange={(e) => setF({ ...f, notasOperativas: e.target.value })}
        maxLength={2000}
      />
      {r.camas.length > 0 && (editable || enAlojamiento) && (
        <p className="text-sm text-piedra">
          Si cambias las fechas, las camas asignadas se mueven con la reserva.
        </p>
      )}
      {guardar.isError && <ErrorConDetalle error={guardar.error} />}
      <div className="flex gap-3">
        <Boton type="submit" cargando={guardar.isPending}>
          Guardar cambios
        </Boton>
        <Boton variante="secundario" onClick={onListo}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

export default function DetalleReserva() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const puedeGestionar = usePermiso('reservas:gestionar');
  const puedeCancelar = usePermiso('reservas:cancelar');
  const [accion, setAccion] = useState<Accion | null>(null);
  const [motivo, setMotivo] = useState('');
  const [asignando, setAsignando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);

  const {
    data: r,
    isLoading,
    error,
  } = useQuery({ queryKey: ['reserva', id], queryFn: () => admin.reserva(id) });
  useTitulo(r ? `Reserva ${r.codigo}` : 'Reserva');

  const refrescar = () => qc.invalidateQueries();
  const cambiarEstado = useMutation({
    mutationFn: (a: Accion) =>
      admin.cambiarEstado(id, a.estado, a.estado === 'CANCELADA' ? motivo.trim() : undefined),
    onSuccess: () => {
      setAccion(null);
      setMotivo('');
      void refrescar();
    },
  });
  const asignar = useMutation({
    mutationFn: () => admin.asignarCamas(id, { camaIds: seleccion }),
    onSuccess: () => {
      setAsignando(false);
      setSeleccion([]);
      void refrescar();
    },
  });
  const quitar = useMutation({
    mutationFn: (camaId: string) => admin.quitarCama(id, camaId),
    onSuccess: () => void refrescar(),
  });

  if (isLoading) return <Cargando />;
  if (error || !r) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const acciones = accionesDisponibles(r.estado).filter((a) =>
    a.permiso === 'reservas:cancelar' ? puedeCancelar : puedeGestionar,
  );
  const asignable = [
    'SOLICITUD',
    'PENDIENTE_CONFIRMACION',
    'CONFIRMADA',
    'EN_ALOJAMIENTO',
  ].includes(r.estado);
  const faltanPlazas = r.plazasAsignadas < r.cantidadHuespedes;
  const h = r.huesped;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link to="/panel/reservas" className="text-porton underline underline-offset-4">
          Reservas
        </Link>
      </p>
      <Encabezado
        titulo={`Reserva ${r.codigo}`}
        descripcion={
          <>
            {nombreHuesped(r)}. Del {fechaLarga(r.fechaEntrada)} al {fechaLarga(r.fechaSalida)},{' '}
            {noches(r.fechaEntrada, r.fechaSalida)} noche(s), {r.cantidadHuespedes} huésped(es).
          </>
        }
        acciones={<InsigniaEstado estado={r.estado} />}
      />

      {(r.estado === 'SOLICITUD' || r.estado === 'PENDIENTE_CONFIRMACION') && (
        <div className="mb-5">
          <Aviso tono="pendiente" titulo="Aún no es una reserva confirmada">
            {faltanPlazas
              ? `Para confirmarla, asigna camas para ${r.cantidadHuespedes} persona(s): hay ${r.plazasAsignadas} plaza(s) asignada(s).`
              : 'Ya tiene camas suficientes: puedes confirmarla.'}
          </Aviso>
        </div>
      )}

      {acciones.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {acciones.map((a) => (
            <Boton
              key={a.estado}
              variante={
                a.peligro
                  ? 'peligro'
                  : a.estado === 'PENDIENTE_CONFIRMACION'
                    ? 'secundario'
                    : 'principal'
              }
              onClick={() => {
                cambiarEstado.reset();
                setAccion(a);
              }}
            >
              {a.texto}
            </Boton>
          ))}
          {puedeGestionar && !editando && (
            <Boton variante="sutil" onClick={() => setEditando(true)}>
              Editar reserva
            </Boton>
          )}
        </div>
      )}
      {acciones.length === 0 && puedeGestionar && !editando && (
        <div className="mb-5">
          <Boton variante="sutil" onClick={() => setEditando(true)}>
            Editar notas
          </Boton>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          {editando && (
            <Panel titulo="Editar reserva">
              <Editar r={r} onListo={() => setEditando(false)} />
            </Panel>
          )}
          <Panel
            titulo={`Camas asignadas (${r.plazasAsignadas} de ${r.cantidadHuespedes} plazas)`}
            acciones={
              puedeGestionar &&
              asignable &&
              !asignando && (
                <Boton
                  variante="secundario"
                  onClick={() => {
                    asignar.reset();
                    setAsignando(true);
                  }}
                >
                  Asignar camas
                </Boton>
              )
            }
          >
            {r.camas.length === 0 ? (
              <p className="text-piedra">Esta reserva no tiene camas asignadas.</p>
            ) : (
              <ul className="divide-y divide-linea">
                {r.camas.map((c) => (
                  <li
                    key={c.ocupacionId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      <strong>Habitación {c.habitacion}</strong>, cama {c.identificador}{' '}
                      <span className="text-piedra">
                        ({ETIQUETA_TIPO_CAMA[c.tipo]}, {c.plazas} plaza(s))
                      </span>
                    </span>
                    {puedeGestionar && asignable && (
                      <Boton
                        variante="sutil"
                        cargando={quitar.isPending && quitar.variables === c.camaId}
                        onClick={() => quitar.mutate(c.camaId)}
                      >
                        Quitar
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {quitar.isError && (
              <div className="mt-3">
                <ErrorConDetalle error={quitar.error} />
              </div>
            )}
            {asignando && (
              <div className="mt-4 border-t border-linea pt-4">
                <SelectorCamas
                  entrada={r.fechaEntrada}
                  salida={r.fechaSalida}
                  seleccion={seleccion}
                  onCambiar={setSeleccion}
                  excluirReservaId={r.id}
                  personas={Math.max(0, r.cantidadHuespedes - r.plazasAsignadas)}
                />
                {asignar.isError && (
                  <div className="mt-3">
                    <ErrorConDetalle error={asignar.error} />
                  </div>
                )}
                <div className="mt-4 flex gap-3">
                  <Boton
                    disabled={seleccion.length === 0}
                    cargando={asignar.isPending}
                    onClick={() => asignar.mutate()}
                  >
                    Asignar {seleccion.length > 0 ? `${seleccion.length} cama(s)` : ''}
                  </Boton>
                  <Boton variante="secundario" onClick={() => setAsignando(false)}>
                    Cerrar
                  </Boton>
                </div>
              </div>
            )}
          </Panel>

          <Panel titulo="Historial de cambios">
            <ol className="flex flex-col gap-3">
              {r.historial.map((x) => (
                <li key={x.id} className="border-l-2 border-linea pl-3">
                  <p className="font-semibold">{ETIQUETA_ACCION[x.accion] ?? x.accion}</p>
                  <p className="text-sm text-hierro-2">{describirCambio(x.datos)}</p>
                  <p className="text-sm text-piedra">
                    {momento(x.createdAt)}, {x.usuario?.nombre ?? 'Sitio web'}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel titulo="Huésped titular">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-piedra">Nombre</dt>
              <dd>
                {h.nombres} {h.apellidos}
              </dd>
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
            </dl>
            {h.datosRestringidos && (
              <p className="mt-3 text-sm text-piedra">
                Algunos datos se ocultan según tus permisos.
              </p>
            )}
            <Link
              to={`/panel/huespedes?id=${h.id}`}
              className="mt-3 inline-block text-sm text-porton underline underline-offset-4"
            >
              Ver ficha del huésped
            </Link>
          </Panel>
          <Panel titulo="Datos de la reserva">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-piedra">Canal</dt>
              <dd>{r.canal.nombre}</dd>
              <dt className="text-piedra">Tipo preferido</dt>
              <dd>{r.tipoHabitacionPreferido?.nombre ?? 'Sin preferencia'}</dd>
              <dt className="text-piedra">Responsable</dt>
              <dd>{r.responsable?.nombre ?? 'Sin asignar'}</dd>
              <dt className="text-piedra">Registrada</dt>
              <dd>
                {momento(r.createdAt)}
                {r.creadoPor ? `, por ${r.creadoPor.nombre}` : ', desde el sitio web'}
              </dd>
              {r.confirmadaEn && (
                <>
                  <dt className="text-piedra">Confirmada</dt>
                  <dd>{momento(r.confirmadaEn)}</dd>
                </>
              )}
              {r.canceladaEn && (
                <>
                  <dt className="text-piedra">Cancelada</dt>
                  <dd>
                    {momento(r.canceladaEn)}. {r.motivoCancelacion}
                  </dd>
                </>
              )}
            </dl>
            {r.comentarioHuesped && (
              <div className="mt-4 rounded-md bg-cal-2 p-3">
                <p className="text-sm font-semibold">Comentario del huésped</p>
                <p className="mt-1 whitespace-pre-line">{r.comentarioHuesped}</p>
              </div>
            )}
            {r.notasOperativas && !editando && (
              <div className="mt-4 rounded-md bg-ocre-claro/60 p-3">
                <p className="text-sm font-semibold">Notas operativas</p>
                <p className="mt-1 whitespace-pre-line">{r.notasOperativas}</p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Dialogo
        abierto={accion !== null}
        titulo={accion?.texto ?? ''}
        onCerrar={() => setAccion(null)}
      >
        {accion && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              cambiarEstado.mutate(accion);
            }}
            className="flex flex-col gap-4"
          >
            <p>
              La reserva {r.codigo} pasará a <strong>{ETIQUETA_ESTADO[accion.estado]}</strong>.
              {accion.estado === 'CANCELADA' && ' Las camas asignadas quedarán libres.'}
              {accion.estado === 'FINALIZADA' &&
                ' Si la salida es antes de lo previsto, las noches restantes quedan libres.'}
            </p>
            {accion.estado === 'CANCELADA' && (
              <AreaTexto
                etiqueta="Motivo de la cancelación"
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={500}
              />
            )}
            {cambiarEstado.isError && <ErrorConDetalle error={cambiarEstado.error} />}
            <div className="flex gap-3">
              <Boton
                type="submit"
                variante={accion.peligro ? 'peligro' : 'principal'}
                cargando={cambiarEstado.isPending}
                disabled={accion.estado === 'CANCELADA' && !motivo.trim()}
              >
                {accion.texto}
              </Boton>
              <Boton variante="secundario" onClick={() => setAccion(null)}>
                Volver
              </Boton>
            </div>
          </form>
        )}
      </Dialogo>
    </>
  );
}
