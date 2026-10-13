import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { nuevaClaveIdempotencia } from '../../api/client';
import { publico } from '../../api/endpoints';
import { MODO_DEMO } from '../../api/demo';
import { esApiError, mensajeDeError } from '../../api/errors';
import type { DisponibilidadPublica } from '../../api/tipos';
import { Aviso, AreaTexto, Boton, Campo, Casilla, Selector } from '../../components/ui';
import { useDatosPublicos } from '../../components/publico/LayoutPublico';
import { MARCA } from '../../config/marca';
import { experienciaPorClave } from '../../config/experiencias';
import { FICHAS, type ClaveMaqueta } from '../../config/habitaciones';
import { Icono } from '../../components/publico/Iconos';
import { hoyEnHotel, noches, rangoEstancia, sumarDias } from '../../lib/fechas';
import { useTitulo } from '../../hooks/useSesion';
import { desplazarA } from '../../hooks/useScrollSuave';

interface Formulario {
  fechaEntrada: string;
  fechaSalida: string;
  cantidadHuespedes: string;
  tipoHabitacionId: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  comentario: string;
  aceptaTratamientoDatos: boolean;
  sitioWeb: string;
}

function validar(f: Formulario, hoy: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.fechaEntrada) e.fechaEntrada = 'Elige la fecha de llegada';
  else if (f.fechaEntrada < hoy) e.fechaEntrada = 'La llegada no puede ser anterior a hoy';
  if (!f.fechaSalida) e.fechaSalida = 'Elige la fecha de salida';
  else if (f.fechaEntrada && f.fechaSalida <= f.fechaEntrada)
    e.fechaSalida = 'La salida debe ser posterior a la llegada';
  const n = Number(f.cantidadHuespedes);
  if (!Number.isInteger(n) || n < 1) e.cantidadHuespedes = 'Indica cuántas personas se hospedan';
  if (!f.nombres.trim()) e.nombres = 'Escribe tu nombre';
  if (!f.apellidos.trim()) e.apellidos = 'Escribe tu apellido';
  if (!/^\+?[0-9][0-9 ()-]{6,19}$/.test(f.telefono.trim()))
    e.telefono = 'Escribe un teléfono de contacto válido';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    e.email = 'Revisa el correo electrónico';
  if (!f.aceptaTratamientoDatos)
    e.aceptaTratamientoDatos = 'Necesitamos tu autorización para responder la solicitud';
  return e;
}

export function Solicitar() {
  useTitulo('Solicitar disponibilidad');
  const { data } = useDatosPublicos();
  const hoy = data?.hoy ?? hoyEnHotel();
  const tipos = useMemo(() => data?.tiposHabitacion ?? [], [data]);

  // Lo que llega desde el inicio: plan por motivo de viaje, tipo publicado o ficha de referencia
  const [parametros] = useSearchParams();
  const motivo = experienciaPorClave(parametros.get('motivo'));
  const tipoElegido = parametros.get('tipo');
  const claveFicha = parametros.get('habitacion');
  const ficha = claveFicha && claveFicha in FICHAS ? FICHAS[claveFicha as ClaveMaqueta] : null;

  const [f, setF] = useState<Formulario>(() => ({
    fechaEntrada: '',
    fechaSalida: '',
    cantidadHuespedes: String(ficha?.personas ?? 1),
    tipoHabitacionId: '',
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    comentario: [
      motivo && `Motivo del viaje: ${motivo.pestana.toLowerCase()}.`,
      ficha && `Me interesa una ${ficha.nombre.toLowerCase()}.`,
    ]
      .filter(Boolean)
      .join(' '),
    aceptaTratamientoDatos: false,
    sitioWeb: '',
  }));

  // El tipo elegido en una tarjeta se preselecciona cuando llegan los tipos publicados
  useEffect(() => {
    if (!tipoElegido || !tipos.some((t) => t.id === tipoElegido)) return;
    setF((x) => (x.tipoHabitacionId ? x : { ...x, tipoHabitacionId: tipoElegido }));
  }, [tipoElegido, tipos]);
  const nombreTipo = tipos.find((t) => t.id === (f.tipoHabitacionId || tipoElegido))?.nombre;

  const [errores, setErrores] = useState<Record<string, string>>({});
  // Una clave por solicitud: si la red falla y se reenvía, el hotel no recibe duplicados
  const [clave, setClave] = useState(nuevaClaveIdempotencia);
  const [consulta, setConsulta] = useState<DisponibilidadPublica | null>(null);

  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({ ...e, [k]: '' }));
    if (k === 'fechaEntrada' || k === 'fechaSalida' || k === 'cantidadHuespedes') setConsulta(null);
  };

  const disponibilidad = useMutation({
    mutationFn: () =>
      publico.disponibilidad({
        fechaEntrada: f.fechaEntrada,
        fechaSalida: f.fechaSalida,
        cantidadHuespedes: Number(f.cantidadHuespedes),
      }),
    onSuccess: setConsulta,
  });

  const envio = useMutation({
    mutationFn: () =>
      publico.enviarSolicitud(
        {
          fechaEntrada: f.fechaEntrada,
          fechaSalida: f.fechaSalida,
          cantidadHuespedes: Number(f.cantidadHuespedes),
          tipoHabitacionId: f.tipoHabitacionId || null,
          nombres: f.nombres.trim(),
          apellidos: f.apellidos.trim(),
          telefono: f.telefono.trim(),
          email: f.email.trim() || null,
          comentario: f.comentario.trim() || null,
          aceptaTratamientoDatos: f.aceptaTratamientoDatos,
          sitioWeb: f.sitioWeb,
        },
        clave,
      ),
    onError: (e) => {
      if (esApiError(e)) setErrores(e.erroresPorCampo());
    },
  });

  // Al recibir la solicitud se muestra la confirmación desde arriba
  useEffect(() => {
    if (envio.isSuccess) desplazarA(0, false);
  }, [envio.isSuccess]);

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validar(f, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    envio.mutate();
  };

  const puedeConsultar =
    f.fechaEntrada && f.fechaSalida && f.fechaSalida > f.fechaEntrada && f.fechaEntrada >= hoy;

  if (envio.isSuccess) {
    return (
      <Escenario>
        <div className="panel-entra mx-auto max-w-2xl overflow-hidden rounded-3xl bg-cal text-hierro shadow-2xl">
          <div className="flex items-center justify-between gap-4 bg-hierro px-6 py-4 text-cal sm:px-8">
            <span className="etiqueta-hud">Solicitud recibida</span>
            <span className="etiqueta-hud text-ocre-claro">{MARCA.nombre}</span>
          </div>
          <div className="px-6 py-8 sm:px-8">
            <h1 className="text-4xl">Recibimos tu solicitud</h1>
            {MODO_DEMO && (
              <p className="mt-3 rounded-md bg-ocre-claro px-3 py-2 text-sm text-ocre-texto">
                {envio.data.mensaje}{' '}
                <Link to="/panel/reservas" className="font-semibold underline underline-offset-4">
                  Verla en el panel
                </Link>
              </p>
            )}
            {envio.data.codigo && (
              <p className="mt-6 text-lg">
                Código de tu solicitud:{' '}
                <strong className="font-mono text-2xl tracking-wider text-porton">
                  {envio.data.codigo}
                </strong>
              </p>
            )}
            <div className="mt-6">
              <Aviso tono="pendiente" titulo="Aún no es una reserva confirmada">
                El equipo de {MARCA.nombre} revisará la disponibilidad para{' '}
                {rangoEstancia(f.fechaEntrada, f.fechaSalida)} y te contactará al {f.telefono}
                {f.email ? ` o a ${f.email}` : ''} para confirmarla.
              </Aviso>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/"
                viewTransition
                className="inline-flex min-h-11 items-center rounded-full bg-porton px-5 font-semibold text-cal hover:bg-porton-2"
              >
                Volver al inicio
              </Link>
              <Boton
                variante="secundario"
                className="rounded-full"
                onClick={() => {
                  envio.reset();
                  setClave(nuevaClaveIdempotencia());
                }}
              >
                Enviar otra solicitud
              </Boton>
            </div>
          </div>
        </div>
      </Escenario>
    );
  }

  return (
    <Escenario>
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.4fr] lg:gap-14">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="etiqueta-hud text-brasa-2">Solicitud de disponibilidad</p>
          <h1 className="mt-4 text-[clamp(2rem,9vw,4.4rem)] leading-[0.95] [overflow-wrap:anywhere]">
            Solicitar disponibilidad
          </h1>
          <p className="mt-5 max-w-prose text-lg text-niebla">
            Cuéntanos tus fechas y cuántas personas viajan. Esta solicitud no es una reserva
            confirmada: el equipo del hotel revisa la disponibilidad y te responde, con la tarifa y
            las condiciones.
          </p>
          {(motivo || ficha || nombreTipo) && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {motivo && <Chip etiqueta="Plan" valor={motivo.pestana} />}
              {(nombreTipo || ficha) && (
                <Chip etiqueta="Habitación" valor={nombreTipo ?? ficha?.nombre ?? ''} />
              )}
            </ul>
          )}
          <ol className="mt-10 hidden flex-col gap-5 lg:flex">
            {[
              'Envías tus fechas y tus datos.',
              'El equipo revisa qué camas hay libres.',
              'Te responde con la tarifa y las condiciones para confirmar.',
            ].map((paso, i) => (
              <li key={paso} className="flex items-start gap-4">
                <span className="etiqueta-hud grid size-9 shrink-0 place-items-center rounded-full text-brasa-2 ring-1 ring-brasa-2/40">
                  0{i + 1}
                </span>
                <span className="pt-1.5 text-luz/85">{paso}</span>
              </li>
            ))}
          </ol>
        </aside>

        <div className="panel-entra rounded-3xl bg-cal p-5 text-hierro shadow-[0_40px_120px_-40px_rgb(240_160_75/0.4)] sm:p-8">
          <form onSubmit={enviar} noValidate className="flex flex-col gap-10">
            <fieldset className="flex flex-col gap-5">
              <legend className="mb-4 font-display text-2xl">Tu estadía</legend>
              <div className="grid gap-5 sm:grid-cols-3">
                <Campo
                  etiqueta="Llegada"
                  type="date"
                  required
                  min={hoy}
                  max={sumarDias(hoy, data?.diasMaximosAnticipacion ?? 540)}
                  value={f.fechaEntrada}
                  onChange={(e) => {
                    const v = e.target.value;
                    cambiar('fechaEntrada', v);
                    if (v && (!f.fechaSalida || f.fechaSalida <= v))
                      cambiar('fechaSalida', sumarDias(v, 1));
                  }}
                  error={errores.fechaEntrada}
                />
                <Campo
                  etiqueta="Salida"
                  type="date"
                  required
                  min={f.fechaEntrada ? sumarDias(f.fechaEntrada, 1) : sumarDias(hoy, 1)}
                  value={f.fechaSalida}
                  onChange={(e) => cambiar('fechaSalida', e.target.value)}
                  error={errores.fechaSalida}
                  ayuda={
                    f.fechaEntrada && f.fechaSalida > f.fechaEntrada
                      ? `${noches(f.fechaEntrada, f.fechaSalida)} noche(s)`
                      : undefined
                  }
                />
                <Campo
                  etiqueta="Personas"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  required
                  value={f.cantidadHuespedes}
                  onChange={(e) => cambiar('cantidadHuespedes', e.target.value)}
                  error={errores.cantidadHuespedes}
                />
              </div>
              {tipos.length > 0 && (
                <Selector
                  etiqueta="Tipo de habitación que prefieres (opcional)"
                  value={f.tipoHabitacionId}
                  onChange={(e) => cambiar('tipoHabitacionId', e.target.value)}
                  error={errores.tipoHabitacionId}
                >
                  <option value="">Sin preferencia</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </Selector>
              )}

              <div className="flex flex-col gap-3 rounded-md bg-cal-2 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Boton
                    variante="secundario"
                    disabled={!puedeConsultar}
                    cargando={disponibilidad.isPending}
                    onClick={() => disponibilidad.mutate()}
                  >
                    Consultar disponibilidad
                  </Boton>
                  {!puedeConsultar && (
                    <span className="text-sm text-piedra">Elige primero las fechas.</span>
                  )}
                </div>
                {disponibilidad.isError && (
                  <Aviso tono="error">{mensajeDeError(disponibilidad.error)}</Aviso>
                )}
                {consulta && (
                  <div role="status">
                    <p className="font-semibold">
                      {consulta.hayDisponibilidad
                        ? 'Parece haber cupo para esas fechas.'
                        : 'Esas fechas se ven muy llenas, pero puedes enviar la solicitud y buscamos opciones.'}
                    </p>
                    <p className="text-sm text-piedra">{consulta.aviso}</p>
                  </div>
                )}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-5">
              <legend className="mb-4 font-display text-2xl">Tus datos</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo
                  etiqueta="Nombres"
                  autoComplete="given-name"
                  required
                  value={f.nombres}
                  onChange={(e) => cambiar('nombres', e.target.value)}
                  error={errores.nombres}
                  maxLength={100}
                />
                <Campo
                  etiqueta="Apellidos"
                  autoComplete="family-name"
                  required
                  value={f.apellidos}
                  onChange={(e) => cambiar('apellidos', e.target.value)}
                  error={errores.apellidos}
                  maxLength={100}
                />
                <Campo
                  etiqueta="Teléfono o WhatsApp"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={f.telefono}
                  onChange={(e) => cambiar('telefono', e.target.value)}
                  error={errores.telefono}
                  placeholder="300 123 4567"
                />
                <Campo
                  etiqueta="Correo electrónico (opcional)"
                  type="email"
                  autoComplete="email"
                  value={f.email}
                  onChange={(e) => cambiar('email', e.target.value)}
                  error={errores.email}
                />
              </div>
              <AreaTexto
                etiqueta="¿Algo que debamos saber? (opcional)"
                value={f.comentario}
                onChange={(e) => cambiar('comentario', e.target.value)}
                maxLength={1000}
                ayuda="Por ejemplo, hora aproximada de llegada o si viajan en grupo."
                error={errores.comentario}
              />
              {/* Trampa para robots: oculta para las personas y para los lectores de pantalla */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  No llenar este campo
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={f.sitioWeb}
                    onChange={(e) => cambiar('sitioWeb', e.target.value)}
                  />
                </label>
              </div>
              <Casilla
                checked={f.aceptaTratamientoDatos}
                onChange={(e) => cambiar('aceptaTratamientoDatos', e.target.checked)}
                error={errores.aceptaTratamientoDatos}
                etiqueta={
                  <>
                    Autorizo a {MARCA.nombre} a usar estos datos solo para responder mi solicitud y
                    gestionar mi estadía, según la{' '}
                    <Link
                      to="/privacidad"
                      className="text-porton underline underline-offset-4"
                      target="_blank"
                    >
                      información sobre tratamiento de datos
                    </Link>
                    .
                  </>
                }
              />
            </fieldset>

            {envio.isError && (
              <Aviso tono="error" titulo="No pudimos enviar la solicitud">
                {mensajeDeError(envio.error)}
              </Aviso>
            )}
            <div>
              <Boton type="submit" cargando={envio.isPending} className="min-h-12 px-6 text-lg">
                Enviar solicitud
              </Boton>
            </div>
          </form>
        </div>
      </div>
    </Escenario>
  );
}

// Fondo de la página: rejilla de plano que se desvanece y espacio para el encabezado fijo
function Escenario({ children }: { children: ReactNode }) {
  return (
    <section className="relative px-4 pb-24 pt-28 sm:px-8 md:pt-36">
      <div
        aria-hidden
        className="rejilla absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_55%)]"
      />
      <div className="relative mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function Chip({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <li className="vidrio flex items-center gap-2 rounded-full px-4 py-2 text-sm">
      <Icono nombre="chispa" className="size-4 text-brasa-2" />
      <span className="text-niebla">{etiqueta}:</span>
      <span className="font-semibold">{valor}</span>
    </li>
  );
}
