import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { nuevaClaveIdempotencia } from '../../api/client';
import { publico } from '../../api/endpoints';
import { esApiError, mensajeDeError } from '../../api/errors';
import type { DisponibilidadPublica } from '../../api/tipos';
import { Aviso, AreaTexto, Boton, Campo, Casilla, Selector } from '../../components/ui';
import { useDatosPublicos } from '../../components/publico/LayoutPublico';
import { MARCA } from '../../config/marca';
import { hoyEnHotel, noches, rangoEstancia, sumarDias } from '../../lib/fechas';
import { useTitulo } from '../../hooks/useSesion';

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
  const tipos = data?.tiposHabitacion ?? [];

  const [f, setF] = useState<Formulario>({
    fechaEntrada: '',
    fechaSalida: '',
    cantidadHuespedes: '1',
    tipoHabitacionId: '',
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    comentario: '',
    aceptaTratamientoDatos: false,
    sitioWeb: '',
  });
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
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl">Recibimos tu solicitud</h1>
        {envio.data.codigo && (
          <p className="mt-6 text-lg">
            Código de tu solicitud:{' '}
            <strong className="font-display text-2xl text-porton">{envio.data.codigo}</strong>
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
            className="inline-flex min-h-11 items-center rounded-md bg-porton px-5 font-semibold text-cal"
          >
            Volver al inicio
          </Link>
          <Boton
            variante="secundario"
            onClick={() => {
              envio.reset();
              setClave(nuevaClaveIdempotencia());
            }}
          >
            Enviar otra solicitud
          </Boton>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="text-[2.4rem] sm:text-5xl">Solicitar disponibilidad</h1>
      <p className="mt-4 max-w-prose text-lg text-hierro-2">
        Cuéntanos tus fechas y cuántas personas viajan. Esta solicitud no es una reserva confirmada:
        el equipo del hotel revisa la disponibilidad y te responde, con la tarifa y las condiciones.
      </p>

      <form onSubmit={enviar} noValidate className="mt-10 flex flex-col gap-10">
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
    </section>
  );
}
