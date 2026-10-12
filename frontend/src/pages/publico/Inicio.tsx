import { Link } from 'react-router';
import { ANIOS_DE_HISTORIA, MARCA } from '../../config/marca';
import { Fachada } from '../../components/publico/Fachada';
import { useDatosPublicos } from '../../components/publico/LayoutPublico';
import type { DatosPublicos, Servicio } from '../../api/tipos';
import { useTitulo } from '../../hooks/useSesion';

function enlaceWhatsapp(numero: string): string {
  const texto = encodeURIComponent(
    `Hola, quisiera información sobre disponibilidad en ${MARCA.nombre}.`,
  );
  return `https://wa.me/${numero}?text=${texto}`;
}

const SERVICIOS: Array<{
  clave: 'servicio_desayuno' | 'servicio_parqueadero' | 'servicio_wifi';
  nombre: string;
}> = [
  { clave: 'servicio_desayuno', nombre: 'Desayuno' },
  { clave: 'servicio_parqueadero', nombre: 'Parqueadero' },
  { clave: 'servicio_wifi', nombre: 'Wi-Fi' },
];

function ServiciosPublicados({ ajustes }: { ajustes: DatosPublicos['ajustes'] }) {
  const publicados = SERVICIOS.flatMap((s) => {
    const valor = ajustes[s.clave] as Servicio | undefined;
    return valor ? [{ ...s, valor }] : [];
  });
  if (publicados.length === 0) {
    return (
      <p className="max-w-prose text-hierro-2">
        En tu solicitud puedes preguntarnos por desayuno, parqueadero o Wi-Fi: te confirmamos las
        condiciones al responder.
      </p>
    );
  }
  return (
    <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
      {publicados.map((s) => (
        <div key={s.clave} className="border-t-2 border-hierro pt-3">
          <dt className="font-display text-xl">{s.nombre}</dt>
          {s.valor.descripcion && <dd className="mt-1 text-hierro-2">{s.valor.descripcion}</dd>}
          {s.valor.horario && <dd className="mt-1 text-hierro-2">Horario: {s.valor.horario}</dd>}
          {s.valor.condiciones && <dd className="mt-1 text-piedra">{s.valor.condiciones}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Contacto({ datos }: { datos: DatosPublicos | undefined }) {
  const c = datos?.ajustes.contacto;
  const h = datos?.ajustes.horarios;
  const hayContacto = c && (c.telefono || c.whatsapp || c.email || c.direccion);
  return (
    <section id="contacto" aria-labelledby="titulo-contacto" className="scroll-mt-20 bg-cal-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div>
          <h2 id="titulo-contacto" className="text-3xl sm:text-4xl">
            Contacto
          </h2>
          <p className="mt-3 max-w-prose text-hierro-2">
            {MARCA.ciudad}, {MARCA.departamento}.
          </p>
          {hayContacto ? (
            <ul className="mt-6 flex flex-col gap-3 text-lg">
              {c.direccion && <li>{c.direccion}</li>}
              {c.telefono && (
                <li>
                  Teléfono:{' '}
                  <a
                    className="font-semibold text-porton underline underline-offset-4"
                    href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`}
                  >
                    {c.telefono}
                  </a>
                </li>
              )}
              {c.email && (
                <li>
                  Correo:{' '}
                  <a
                    className="font-semibold text-porton underline underline-offset-4"
                    href={`mailto:${c.email}`}
                  >
                    {c.email}
                  </a>
                </li>
              )}
              {c.whatsapp && (
                <li>
                  <a
                    className="inline-flex min-h-11 items-center rounded-md bg-porton px-4 font-semibold text-cal hover:bg-porton-2"
                    href={enlaceWhatsapp(c.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Escribir por WhatsApp
                  </a>
                </li>
              )}
              {c.mapaUrl && (
                <li>
                  <a
                    className="text-porton underline underline-offset-4"
                    href={c.mapaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver la ubicación en el mapa
                  </a>
                </li>
              )}
              {(c.instagram || c.facebook) && (
                <li className="flex gap-4">
                  {c.instagram && (
                    <a
                      className="text-porton underline underline-offset-4"
                      href={c.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram
                    </a>
                  )}
                  {c.facebook && (
                    <a
                      className="text-porton underline underline-offset-4"
                      href={c.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Facebook
                    </a>
                  )}
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-6 max-w-prose text-hierro-2">
              Muy pronto publicaremos aquí nuestros teléfonos y la dirección. Mientras tanto, envía
              tu solicitud y te contactamos.
            </p>
          )}
        </div>
        <div className="flex flex-col justify-between gap-6 rounded-lg bg-white p-6 ring-1 ring-linea">
          <div>
            <p className="font-display text-2xl">¿Vienes a Popayán?</p>
            <p className="mt-2 text-hierro-2">
              Cuéntanos las fechas y cuántas personas viajan. Revisamos la disponibilidad y te
              respondemos para confirmar.
            </p>
            {h && (h.entrada || h.salida) && (
              <p className="mt-4 text-hierro-2">
                {h.entrada && <>Entrada desde las {h.entrada}. </>}
                {h.salida && <>Salida hasta las {h.salida}.</>}
              </p>
            )}
          </div>
          <Link
            to="/solicitar"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-porton px-5 text-lg font-semibold text-cal hover:bg-porton-2"
          >
            Solicitar disponibilidad
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Inicio() {
  useTitulo('');
  const { data } = useDatosPublicos();
  const anios = ANIOS_DE_HISTORIA(Number((data?.hoy ?? '2026').slice(0, 4)));
  const restaurante = data?.ajustes.restaurante;
  const tipos = data?.tiposHabitacion ?? [];

  return (
    <>
      {/* Portada: la fachada encalada es la imagen del hotel en su ciudad */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 pt-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-16">
          <div className="pb-10 md:pb-20">
            <p className="text-lg text-porton">
              {MARCA.ciudad}, {MARCA.departamento}
            </p>
            <h1 className="mt-3 text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.98] tracking-tight">
              {MARCA.nombre}
            </h1>
            <p className="mt-6 max-w-[34ch] text-xl leading-relaxed text-hierro-2">
              Alojamiento y mesa familiar. Empezamos en {MARCA.anioOrigen} con una pizzería; hoy
              también te recibimos para quedarte.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/solicitar"
                className="inline-flex min-h-12 items-center rounded-md bg-porton px-6 text-lg font-semibold text-cal hover:bg-porton-2"
              >
                Solicitar disponibilidad
              </Link>
              <a
                href="#historia"
                className="inline-flex min-h-12 items-center rounded-md px-4 text-lg font-semibold text-porton underline-offset-4 hover:underline"
              >
                Conocer la historia
              </a>
            </div>
          </div>
          <Fachada className="mx-auto w-full max-w-md text-hierro md:max-w-none" />
        </div>
        <div
          aria-hidden
          className="h-3 bg-[repeating-linear-gradient(90deg,var(--color-hierro)_0_18px,transparent_18px_26px)] opacity-80"
        />
      </section>

      <section id="historia" aria-labelledby="titulo-historia" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 id="titulo-historia" className="text-3xl sm:text-4xl">
            {anios} años de historia
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-2">
            <li className="relative border-l-4 border-ocre pl-6">
              <p className="font-display text-5xl text-ocre-texto">{MARCA.anioOrigen}</p>
              <p className="mt-3 max-w-prose text-lg">{MARCA.historia.origen}</p>
            </li>
            <li className="relative border-l-4 border-porton pl-6">
              <p className="font-display text-5xl text-porton">Hoy</p>
              <p className="mt-3 max-w-prose text-lg">{MARCA.historia.hoy}</p>
            </li>
          </ol>
        </div>
      </section>

      <section
        id="alojamiento"
        aria-labelledby="titulo-alojamiento"
        className="scroll-mt-20 border-t border-linea"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.4fr] md:py-24">
          <div>
            <h2 id="titulo-alojamiento" className="text-3xl sm:text-4xl">
              Alojamiento
            </h2>
            <p className="mt-4 max-w-prose text-lg text-hierro-2">
              Habitaciones para quienes llegan a Popayán por trabajo, por salud, por estudio o para
              conocer la ciudad, y espacio para grupos.
            </p>
          </div>
          <div className="flex flex-col gap-8">
            {tipos.length > 0 ? (
              <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {tipos.map((t) => (
                  <li key={t.id} className="border-t-2 border-hierro pt-3">
                    <p className="font-display text-xl">{t.nombre}</p>
                    {t.descripcion && <p className="mt-1 text-hierro-2">{t.descripcion}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {MARCA.publico.map((p) => (
                  <li key={p} className="border-t-2 border-hierro pt-3 text-lg">
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <ServiciosPublicados ajustes={data?.ajustes ?? {}} />
          </div>
        </div>
      </section>

      <section
        id="restaurante"
        aria-labelledby="titulo-restaurante"
        className="scroll-mt-20 bg-porton text-cal"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <h2 id="titulo-restaurante" className="text-3xl sm:text-4xl">
            Restaurante y pizzería
          </h2>
          <div className="text-lg">
            <p className="max-w-prose">
              {restaurante?.descripcion ??
                `El Recuerdo nació como pizzería en ${MARCA.anioOrigen}. Hoy, además del alojamiento, la casa ofrece restaurante y pizzería.`}
            </p>
            {restaurante?.horario && (
              <p className="mt-4 text-cal/85">Horario: {restaurante.horario}</p>
            )}
          </div>
        </div>
      </section>

      <Contacto datos={data} />
    </>
  );
}
