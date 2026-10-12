import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../api/endpoints';
import { ApiError, mensajeDeError } from '../../api/errors';
import type { Roles } from '../../api/tipos';
import { Encabezado, Panel } from '../../components/admin/comunes';
import { Aviso, Boton, Campo, Cargando, Casilla, Selector } from '../../components/ui';
import { momento } from '../../lib/fechas';
import { useTitulo } from '../../hooks/useSesion';

function PermisosRol({
  rol,
  catalogo,
}: {
  rol: Roles['roles'][number];
  catalogo: Roles['catalogo'];
}) {
  const qc = useQueryClient();
  const [permisos, setPermisos] = useState(rol.permisos);
  const guardar = useMutation({
    mutationFn: () => admin.permisosRol(rol.id, permisos),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['roles'] }),
  });
  const cambiado = [...permisos].sort().join() !== [...rol.permisos].sort().join();
  return (
    <Panel titulo={`${rol.nombre} (${rol.usuarios} persona(s))`}>
      {rol.descripcion && <p className="mb-3 text-sm text-piedra">{rol.descripcion}</p>}
      <fieldset>
        <legend className="sr-only">Permisos de {rol.nombre}</legend>
        <ul className="flex flex-col gap-2">
          {catalogo.map((p) => (
            <li key={p.codigo}>
              <Casilla
                etiqueta={p.descripcion}
                checked={permisos.includes(p.codigo)}
                onChange={(e) =>
                  setPermisos(
                    e.target.checked
                      ? [...permisos, p.codigo]
                      : permisos.filter((x) => x !== p.codigo),
                  )
                }
              />
            </li>
          ))}
        </ul>
      </fieldset>
      {guardar.isError && (
        <div className="mt-3">
          <Aviso tono="error">{mensajeDeError(guardar.error)}</Aviso>
        </div>
      )}
      <Boton
        className="mt-4"
        disabled={!cambiado}
        cargando={guardar.isPending}
        onClick={() => guardar.mutate()}
      >
        Guardar permisos
      </Boton>
    </Panel>
  );
}

export default function Usuarios() {
  useTitulo('Personal y permisos');
  const qc = useQueryClient();
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: admin.usuarios });
  const roles = useQuery({ queryKey: ['roles'], queryFn: admin.roles });
  const [f, setF] = useState({ nombre: '', email: '', rolId: '', password: '' });
  const crear = useMutation({
    mutationFn: () => admin.crearUsuario({ ...f, nombre: f.nombre.trim(), email: f.email.trim() }),
    onSuccess: () => {
      setF({ nombre: '', email: '', rolId: '', password: '' });
      void qc.invalidateQueries();
    },
  });
  const editar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      admin.editarUsuario(id, body),
    onSuccess: () => void qc.invalidateQueries(),
  });
  const e = crear.error instanceof ApiError ? crear.error.erroresPorCampo() : {};

  return (
    <>
      <Encabezado
        titulo="Personal y permisos"
        descripcion="Cada persona entra con su propio correo. Los permisos se asignan por rol y aplican de inmediato."
      />
      {(usuarios.isLoading || roles.isLoading) && <Cargando />}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel titulo="Personal">
          <ul className="divide-y divide-linea">
            {usuarios.data?.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <strong className={u.activo ? '' : 'text-piedra line-through'}>{u.nombre}</strong>
                  <span className="block text-sm text-piedra">
                    {u.email}. Último ingreso: {momento(u.ultimoAcceso)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  <label className="sr-only" htmlFor={`rol-${u.id}`}>
                    Rol de {u.nombre}
                  </label>
                  <select
                    id={`rol-${u.id}`}
                    value={u.rol.id}
                    onChange={(x) => editar.mutate({ id: u.id, body: { rolId: x.target.value } })}
                    className="min-h-10 rounded-md border border-linea bg-white px-2"
                  >
                    {roles.data?.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                  <Boton
                    variante="sutil"
                    onClick={() => editar.mutate({ id: u.id, body: { activo: !u.activo } })}
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                  <Boton
                    variante="sutil"
                    onClick={() => {
                      const nueva = window.prompt(
                        `Nueva contraseña para ${u.nombre} (mínimo 12 caracteres). Sus sesiones abiertas se cerrarán.`,
                      );
                      if (nueva) editar.mutate({ id: u.id, body: { password: nueva } });
                    }}
                  >
                    Restablecer contraseña
                  </Boton>
                </span>
              </li>
            ))}
          </ul>
          {editar.isError && <Aviso tono="error">{mensajeDeError(editar.error)}</Aviso>}
          <form
            onSubmit={(ev: FormEvent) => {
              ev.preventDefault();
              crear.mutate();
            }}
            className="mt-4 grid gap-3 border-t border-linea pt-4 sm:grid-cols-2"
          >
            <h3 className="font-sans text-base font-semibold sm:col-span-2">Agregar una persona</h3>
            <Campo
              etiqueta="Nombre"
              required
              value={f.nombre}
              onChange={(x) => setF({ ...f, nombre: x.target.value })}
              error={e.nombre}
            />
            <Campo
              etiqueta="Correo"
              type="email"
              required
              value={f.email}
              onChange={(x) => setF({ ...f, email: x.target.value })}
              error={e.email}
            />
            <Selector
              etiqueta="Rol"
              required
              value={f.rolId}
              onChange={(x) => setF({ ...f, rolId: x.target.value })}
              error={e.rolId}
            >
              <option value="">Selecciona…</option>
              {roles.data?.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </Selector>
            <Campo
              etiqueta="Contraseña inicial"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={f.password}
              onChange={(x) => setF({ ...f, password: x.target.value })}
              error={e.password}
              ayuda="Mínimo 12 caracteres. Pídele que la cambie al entrar."
            />
            {crear.isError && (
              <div className="sm:col-span-2">
                <Aviso tono="error">{mensajeDeError(crear.error)}</Aviso>
              </div>
            )}
            <div>
              <Boton type="submit" cargando={crear.isPending}>
                Agregar persona
              </Boton>
            </div>
          </form>
        </Panel>
        <div className="flex flex-col gap-5">
          {roles.data?.roles.map((r) => (
            <PermisosRol key={r.id + r.permisos.join()} rol={r} catalogo={roles.data.catalogo} />
          ))}
        </div>
      </div>
    </>
  );
}
