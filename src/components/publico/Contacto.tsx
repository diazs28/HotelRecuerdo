import { useRef } from 'react';
import { Link } from 'react-router';
import type { DatosPublicos, Servicio } from '../../api/tipos';
import { MARCA } from '../../config/marca';
import { useRevelar } from '../../hooks/useRevelar';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { Icono, type NombreIcono } from './Iconos';

function enlaceWhatsapp(numero: string): string {
  const texto = encodeURIComponent(
    `Hola, quisiera información sobre disponibilidad en ${MARCA.nombre}.`,
  );
  return `https://wa.me/${numero}?text=${texto}`;
}

const SERVICIOS: Array<{
  clave: 'servicio_desayuno' | 'servicio_parqueadero' | 'servicio_wifi';
  nombre: string;
  icono: NombreIcono;
}> = [
  { clave: 'servicio_desayuno', nombre: 'Desayuno', icono: 'desayuno' },
  { clave: 'servicio_parqueadero', nombre: 'Parqueadero', icono: 'parqueadero' },
  { clave: 'servicio_wifi', nombre: 'Wi-Fi', icono: 'wifi' },
];

// Solo se muestran los servicios que la administración confirmó y publicó en el panel
function Servicios({ ajustes }: { ajustes: DatosPublicos['ajustes'] }) {
  const publicados = SERVICIOS.flatMap((s) => {
    const valor = ajustes[s.clave] as Servicio | undefined;
    return valor ? [{ ...s, valor }] : [];
  });
  if (publicados.length === 0) {
    return (
      <p data-revelar className="revelar max-w-prose text-niebla">
        En tu solicitud puedes preguntarnos por desayuno, parqueadero o Wi-Fi: te confirmamos las
        condiciones al responder.
      </p>
    );
  }
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {publicados.map((s, i) => (
        <div
          key={s.clave}
          data-revelar
          style={{ ['--retraso' as string]: i }}
          className="revelar vidrio rounded-3xl p-6"
        >
          <dt className="flex items-center gap-3 font-display text-xl">
            <Icono nombre={s.icono} className="size-7 text-brasa-2" />
            {s.nombre}
          </dt>
          {s.valor.descripcion && <dd className="mt-3 text-luz/85">{s.valor.descripcion}</dd>}
          {s.valor.horario && <dd className="mt-1 text-niebla">Horario: {s.valor.horario}</dd>}
          {s.valor.condiciones && (
            <dd className="mt-1 text-sm text-niebla">{s.valor.condiciones}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

const enlace = 'font-semibold text-brasa-2 underline-offset-4 hover:underline';

export function Contacto({ datos }: { datos: DatosPublicos | undefined }) {
  const raiz = useRef<HTMLElement>(null);
  const c = datos?.ajustes.contacto;
  const h = datos?.ajustes.horarios;
  const hayContacto = c && (c.telefono || c.whatsapp || c.email || c.direccion);
  useRevelar(raiz, [datos]);

  return (
    <section
      ref={raiz}
      id="contacto"
      aria-labelledby="titulo-contacto"
      className="relative scroll-mt-20 px-4 py-24 sm:px-6 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <EncabezadoSeccion
          numero="05"
          etiqueta="Llegar"
          id="titulo-contacto"
          titulo="Te esperamos en la Ciudad Blanca"
        >
          {MARCA.ciudad}, {MARCA.departamento}.
        </EncabezadoSeccion>

        <div className="mt-12">
          <Servicios ajustes={datos?.ajustes ?? {}} />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div data-revelar className="revelar vidrio rounded-3xl p-6 sm:p-8">
            <p className="etiqueta-hud text-brasa-2">Contacto</p>
            {hayContacto ? (
              <ul className="mt-5 flex flex-col gap-4 text-lg">
                {c.direccion && (
                  <li className="flex items-start gap-3">
                    <Icono nombre="ubicacion" className="mt-0.5 size-6 shrink-0 text-brasa-2" />
                    {c.direccion}
                  </li>
                )}
                {c.telefono && (
                  <li className="flex items-center gap-3">
                    <Icono nombre="telefono" className="size-6 shrink-0 text-brasa-2" />
                    <a className={enlace} href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`}>
                      {c.telefono}
                    </a>
                  </li>
                )}
                {c.email && (
                  <li className="flex items-center gap-3">
                    <Icono nombre="correo" className="size-6 shrink-0 text-brasa-2" />
                    <a className={enlace} href={`mailto:${c.email}`}>
                      {c.email}
                    </a>
                  </li>
                )}
                {c.mapaUrl && (
                  <li>
                    <a
                      className={enlace}
                      href={c.mapaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver la ubicación en el mapa
                    </a>
                  </li>
                )}
                {(c.instagram || c.facebook) && (
                  <li className="flex gap-5">
                    {c.instagram && (
                      <a
                        className={enlace}
                        href={c.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Instagram
                      </a>
                    )}
                    {c.facebook && (
                      <a
                        className={enlace}
                        href={c.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Facebook
                      </a>
                    )}
                  </li>
                )}
                {c.whatsapp && (
                  <li>
                    <a
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-jade px-5 font-semibold text-noche transition hover:brightness-110"
                      href={enlaceWhatsapp(c.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icono nombre="mensaje" className="size-5" />
                      Escribir por WhatsApp
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-5 max-w-prose text-niebla">
                Muy pronto publicaremos aquí nuestros teléfonos y la dirección. Mientras tanto,
                envía tu solicitud y te contactamos.
              </p>
            )}
          </div>

          <div
            data-revelar
            style={{ ['--retraso' as string]: 1 }}
            className="revelar relative flex flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-linear-to-br from-brasa-2 to-brasa p-6 text-noche sm:p-8"
          >
            <Icono nombre="llave" className="absolute -right-6 -top-6 size-40 opacity-15" />
            <div>
              <p className="font-display text-3xl sm:text-4xl">¿Vienes a {MARCA.ciudad}?</p>
              <p className="mt-3 max-w-md text-noche/80">
                Cuéntanos las fechas y cuántas personas viajan. Revisamos la disponibilidad y te
                respondemos para confirmar.
              </p>
              {h && (h.entrada || h.salida) && (
                <p className="mt-4 font-semibold">
                  {h.entrada && <>Entrada desde las {h.entrada}. </>}
                  {h.salida && <>Salida hasta las {h.salida}.</>}
                </p>
              )}
            </div>
            <Link
              to="/solicitar"
              viewTransition
              className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-noche px-6 text-lg font-semibold text-luz transition hover:-translate-y-0.5"
            >
              Solicitar disponibilidad
              <Icono nombre="flechaDerecha" className="size-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
