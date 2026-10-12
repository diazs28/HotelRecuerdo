import { useDatosPublicos } from '../../components/publico/LayoutPublico';
import { Aviso } from '../../components/ui';
import { MARCA } from '../../config/marca';
import { useTitulo } from '../../hooks/useSesion';

// Texto base de tratamiento de datos. La política oficial (responsable, NIT, canales de atención)
// la debe entregar y validar la administración del hotel; se configura en el panel.
export function Privacidad() {
  useTitulo('Tratamiento de datos personales');
  const { data } = useDatosPublicos();
  const td = data?.ajustes.tratamiento_datos;
  const contacto = data?.ajustes.contacto;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="text-4xl">Tratamiento de datos personales</h1>
      {!td && (
        <div className="mt-6">
          <Aviso tono="pendiente" titulo="Información en revisión">
            El hotel está preparando su política completa de tratamiento de datos. Mientras tanto,
            aplica lo que se describe en esta página.
          </Aviso>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-5 text-lg leading-relaxed">
        <p>
          Cuando envías una solicitud desde este sitio, {td?.responsable ?? MARCA.nombre}
          {td?.nit ? ` (NIT ${td.nit})` : ''} recibe tu nombre, tu teléfono, tu correo si lo
          escribes, las fechas de tu estadía y tu comentario.
        </p>
        <p>
          Este sitio usa esos datos únicamente para tramitar tu solicitud y gestionar tu reserva y
          tu estadía.
        </p>
        <p>
          Como titular, puedes conocer, actualizar y rectificar tus datos, y pedir que los
          eliminemos cuando ya no sean necesarios, de acuerdo con la Ley 1581 de 2012.
          {td?.correoContacto || contacto?.email ? (
            <>
              {' '}
              Escríbenos a{' '}
              <a
                className="text-porton underline underline-offset-4"
                href={`mailto:${td?.correoContacto ?? contacto?.email}`}
              >
                {td?.correoContacto ?? contacto?.email}
              </a>
              .
            </>
          ) : (
            ' Puedes hacerlo directamente en la recepción del hotel.'
          )}
        </p>
        {td?.politicaUrl && (
          <p>
            <a
              className="text-porton underline underline-offset-4"
              href={td.politicaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar la política completa
            </a>
            {td.version ? ` (versión ${td.version})` : ''}.
          </p>
        )}
      </div>
    </article>
  );
}
