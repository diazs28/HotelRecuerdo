import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sesionApi } from '../../api/endpoints';
import { ApiError, mensajeDeError } from '../../api/errors';
import { guardarSesion, sesionActual } from '../../api/session';
import { Encabezado, Panel } from '../../components/admin/comunes';
import { Aviso, Boton, Campo } from '../../components/ui';
import { useSesion, useTitulo } from '../../hooks/useSesion';

export default function Cuenta() {
  useTitulo('Mi cuenta');
  const sesion = useSesion();
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState('');
  const cambiar = useMutation({
    mutationFn: () => sesionApi.cambiarPassword(f.actual, f.nueva),
    onSuccess: (r) => {
      const s = sesionActual();
      if (s) guardarSesion({ ...s, token: r.token, expiraEn: r.expiraEn });
      setF({ actual: '', nueva: '', repetir: '' });
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (f.nueva !== f.repetir) return setError('Las contraseñas nuevas no coinciden');
    setError('');
    cambiar.mutate();
  };
  const errores = cambiar.error instanceof ApiError ? cambiar.error.erroresPorCampo() : {};
  return (
    <>
      <Encabezado
        titulo="Mi cuenta"
        descripcion={`${sesion?.usuario.nombre ?? ''}, ${sesion?.usuario.rol.nombre ?? ''}.`}
      />
      <Panel titulo="Cambiar contraseña" className="max-w-xl">
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo
            etiqueta="Contraseña actual"
            type="password"
            autoComplete="current-password"
            required
            value={f.actual}
            onChange={(e) => setF({ ...f, actual: e.target.value })}
            error={errores.passwordActual}
          />
          <Campo
            etiqueta="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={f.nueva}
            onChange={(e) => setF({ ...f, nueva: e.target.value })}
            error={errores.passwordNueva}
            ayuda="Mínimo 12 caracteres. Se cerrarán tus otras sesiones."
          />
          <Campo
            etiqueta="Repite la nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            value={f.repetir}
            onChange={(e) => setF({ ...f, repetir: e.target.value })}
            error={error}
          />
          {cambiar.isError && <Aviso tono="error">{mensajeDeError(cambiar.error)}</Aviso>}
          {cambiar.isSuccess && <Aviso tono="exito">Contraseña actualizada.</Aviso>}
          <div>
            <Boton type="submit" cargando={cambiar.isPending}>
              Cambiar contraseña
            </Boton>
          </div>
        </form>
      </Panel>
    </>
  );
}
