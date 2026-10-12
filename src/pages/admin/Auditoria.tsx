import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { mensajeDeError } from '../../api/errors';
import { Encabezado, Panel } from '../../components/admin/comunes';
import { Aviso, Cargando, Paginacion, Selector } from '../../components/ui';
import { ETIQUETA_ACCION } from '../../lib/estados';
import { momento } from '../../lib/fechas';
import { useTitulo } from '../../hooks/useSesion';

const ENTIDADES: Record<string, string> = {
  reserva: 'Reservas',
  habitacion: 'Habitaciones',
  cama: 'Camas',
  bloqueo: 'Bloqueos',
  huesped: 'Huéspedes',
  ajuste: 'Datos del hotel',
  usuario: 'Personal',
  rol: 'Roles',
};

export default function Auditoria() {
  useTitulo('Auditoría');
  const [entidad, setEntidad] = useState('');
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditoria', entidad, pagina],
    queryFn: () => admin.auditoria({ entidad: entidad || undefined, pagina }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <Encabezado
        titulo="Auditoría"
        descripcion="Registro de cambios con fecha y responsable. No se puede editar ni borrar."
      />
      <div className="mb-4 w-64">
        <Selector
          etiqueta="Mostrar"
          value={entidad}
          onChange={(e) => {
            setEntidad(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todo</option>
          {Object.entries(ENTIDADES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selector>
      </div>
      {isLoading && <Cargando />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      {data && (
        <Panel>
          <ul className="divide-y divide-linea">
            {data.registros.map((r) => (
              <li key={r.id} className="py-2.5">
                <p>
                  <strong>{ETIQUETA_ACCION[r.accion] ?? r.accion}</strong>
                  {r.entidad === 'reserva' && (
                    <>
                      {'. '}
                      <Link
                        className="text-porton underline underline-offset-4"
                        to={`/panel/reservas/${r.entidadId}`}
                      >
                        ver reserva
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-sm text-piedra">
                  {momento(r.createdAt)}, {r.usuario?.nombre ?? 'Sitio web'}
                </p>
              </li>
            ))}
          </ul>
          <Paginacion
            pagina={data.pagina}
            total={data.total}
            porPagina={data.porPagina}
            onCambiar={setPagina}
          />
        </Panel>
      )}
    </>
  );
}
