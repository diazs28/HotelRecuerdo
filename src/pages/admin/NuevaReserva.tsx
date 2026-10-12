import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nuevaClaveIdempotencia } from '../../api/client';
import { admin } from '../../api/endpoints';
import { esApiError, mensajeDeError } from '../../api/errors';
import { Encabezado, Panel } from '../../components/admin/comunes';
import { SelectorCamas } from '../../components/admin/SelectorCamas';
import { AreaTexto, Aviso, Boton, Campo, Selector } from '../../components/ui';
import { ETIQUETA_DOCUMENTO } from '../../lib/estados';
import { hoyEnHotel, noches, sumarDias } from '../../lib/fechas';
import { useSesion, useTitulo } from '../../hooks/useSesion';

export default function NuevaReserva() {
  useTitulo('Nueva reserva');
  const navegar = useNavigate();
  const qc = useQueryClient();
  const sesion = useSesion();
  const hoy = hoyEnHotel();

  const canales = useQuery({ queryKey: ['canales'], queryFn: admin.canales });
  const tipos = useQuery({ queryKey: ['tipos'], queryFn: admin.tiposHabitacion });
  const personal = useQuery({ queryKey: ['personal'], queryFn: admin.personal });

  const [f, setF] = useState({
    fechaEntrada: hoy,
    fechaSalida: sumarDias(hoy, 1),
    cantidadHuespedes: '1',
    canalId: '',
    tipoHabitacionPreferidoId: '',
    responsableId: sesion?.usuario.id ?? '',
    notasOperativas: '',
    estadoInicial: 'PENDIENTE_CONFIRMACION',
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    tipoDocumento: '',
    numeroDocumento: '',
  });
  const [camas, setCamas] = useState<string[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [clave] = useState(nuevaClaveIdempotencia);
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({ ...e, [k]: '' }));
    if (k === 'fechaEntrada' || k === 'fechaSalida') setCamas([]);
  };

  const crear = useMutation({
    mutationFn: () =>
      admin.crearReserva(
        {
          huesped: {
            nombres: f.nombres.trim(),
            apellidos: f.apellidos.trim(),
            telefono: f.telefono.trim() || null,
            email: f.email.trim() || null,
            tipoDocumento: f.tipoDocumento || null,
            numeroDocumento: f.numeroDocumento.trim() || null,
          },
          canalId: f.canalId,
          fechaEntrada: f.fechaEntrada,
          fechaSalida: f.fechaSalida,
          cantidadHuespedes: Number(f.cantidadHuespedes),
          tipoHabitacionPreferidoId: f.tipoHabitacionPreferidoId || null,
          responsableId: f.responsableId || null,
          notasOperativas: f.notasOperativas.trim() || null,
          estadoInicial: f.estadoInicial,
          camaIds: camas,
        },
        clave,
      ),
    onSuccess: (r) => {
      void qc.invalidateQueries();
      navegar(`/panel/reservas/${r.id}`);
    },
    onError: (e) => {
      if (esApiError(e)) {
        const porCampo = e.erroresPorCampo();
        // "huesped.nombres" -> "nombres"
        setErrores(
          Object.fromEntries(
            Object.entries(porCampo).map(([k, v]) => [k.replace(/^huesped\./, ''), v]),
          ),
        );
      }
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.nombres.trim()) err.nombres = 'Escribe el nombre';
    if (!f.apellidos.trim()) err.apellidos = 'Escribe el apellido';
    if (!f.telefono.trim() && !f.email.trim()) err.telefono = 'Indica un teléfono o un correo';
    if (!f.canalId) err.canalId = 'Selecciona el canal';
    if (f.fechaSalida <= f.fechaEntrada)
      err.fechaSalida = 'La salida debe ser posterior a la entrada';
    if (Boolean(f.tipoDocumento) !== Boolean(f.numeroDocumento.trim()))
      err.numeroDocumento = 'Indica el tipo y el número juntos';
    setErrores(err);
    if (Object.keys(err).length === 0) crear.mutate();
  };

  const n = f.fechaSalida > f.fechaEntrada ? noches(f.fechaEntrada, f.fechaSalida) : 0;

  return (
    <>
      <Encabezado
        titulo="Nueva reserva"
        descripcion="Registra una reserva recibida por teléfono, WhatsApp, en recepción u otro canal. Para confirmarla, asigna camas suficientes."
      />
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <Panel titulo="Estadía">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              etiqueta="Entrada"
              type="date"
              required
              value={f.fechaEntrada}
              onChange={(e) => set('fechaEntrada', e.target.value)}
              error={errores.fechaEntrada}
            />
            <Campo
              etiqueta="Salida"
              type="date"
              required
              min={sumarDias(f.fechaEntrada, 1)}
              value={f.fechaSalida}
              onChange={(e) => set('fechaSalida', e.target.value)}
              error={errores.fechaSalida}
              ayuda={n > 0 ? `${n} noche(s)` : undefined}
            />
            <Campo
              etiqueta="Huéspedes"
              type="number"
              min={1}
              max={200}
              required
              value={f.cantidadHuespedes}
              onChange={(e) => set('cantidadHuespedes', e.target.value)}
              error={errores.cantidadHuespedes}
            />
            <Selector
              etiqueta="Canal de origen"
              required
              value={f.canalId}
              onChange={(e) => set('canalId', e.target.value)}
              error={errores.canalId}
            >
              <option value="">Selecciona…</option>
              {canales.data
                ?.filter((c) => c.activo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Selector>
            <Selector
              etiqueta="Tipo preferido"
              value={f.tipoHabitacionPreferidoId}
              onChange={(e) => set('tipoHabitacionPreferidoId', e.target.value)}
            >
              <option value="">Sin preferencia</option>
              {tipos.data
                ?.filter((t) => t.activo)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
            </Selector>
            <Selector
              etiqueta="Responsable"
              value={f.responsableId}
              onChange={(e) => set('responsableId', e.target.value)}
            >
              <option value="">Sin asignar</option>
              {personal.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
            <Selector
              etiqueta="Estado inicial"
              value={f.estadoInicial}
              onChange={(e) => set('estadoInicial', e.target.value)}
            >
              <option value="PENDIENTE_CONFIRMACION">Pendiente de confirmación</option>
              <option value="SOLICITUD">Solicitud</option>
            </Selector>
          </div>
          <div className="mt-4">
            <AreaTexto
              etiqueta="Notas operativas"
              value={f.notasOperativas}
              onChange={(e) => set('notasOperativas', e.target.value)}
              maxLength={2000}
              ayuda="Visibles solo para el personal. No escribas datos sensibles (salud, pagos con tarjeta)."
            />
          </div>
        </Panel>

        <Panel titulo="Huésped titular">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              etiqueta="Nombres"
              required
              value={f.nombres}
              onChange={(e) => set('nombres', e.target.value)}
              error={errores.nombres}
            />
            <Campo
              etiqueta="Apellidos"
              required
              value={f.apellidos}
              onChange={(e) => set('apellidos', e.target.value)}
              error={errores.apellidos}
            />
            <Campo
              etiqueta="Teléfono"
              type="tel"
              value={f.telefono}
              onChange={(e) => set('telefono', e.target.value)}
              error={errores.telefono}
            />
            <Campo
              etiqueta="Correo"
              type="email"
              value={f.email}
              onChange={(e) => set('email', e.target.value)}
              error={errores.email}
            />
            <Selector
              etiqueta="Tipo de documento"
              value={f.tipoDocumento}
              onChange={(e) => set('tipoDocumento', e.target.value)}
            >
              <option value="">No registrar ahora</option>
              {Object.entries(ETIQUETA_DOCUMENTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Selector>
            <Campo
              etiqueta="Número de documento"
              value={f.numeroDocumento}
              onChange={(e) => set('numeroDocumento', e.target.value)}
              error={errores.numeroDocumento}
            />
          </div>
        </Panel>

        <Panel titulo="Camas (opcional)">
          <SelectorCamas
            entrada={f.fechaEntrada}
            salida={f.fechaSalida}
            seleccion={camas}
            onCambiar={setCamas}
            personas={Number(f.cantidadHuespedes) || 1}
          />
        </Panel>

        {crear.isError && (
          <Aviso tono="error" titulo="No se pudo crear la reserva">
            {mensajeDeError(crear.error)}
            {esApiError(crear.error) && crear.error.code === 'CAMA_NO_DISPONIBLE' && (
              <ul className="mt-2 list-disc pl-5">
                {crear.error.details.map((d) => (
                  <li key={d.message}>{d.message}</li>
                ))}
              </ul>
            )}
          </Aviso>
        )}
        <div className="flex gap-3">
          <Boton type="submit" cargando={crear.isPending}>
            Crear reserva
          </Boton>
          <Boton variante="secundario" onClick={() => navegar(-1)}>
            Volver
          </Boton>
        </div>
      </form>
    </>
  );
}
