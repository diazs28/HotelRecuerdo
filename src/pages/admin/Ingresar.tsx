import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { sesionApi } from '../../api/endpoints';
import { guardarSesion } from '../../api/session';
import { mensajeDeError } from '../../api/errors';
import { Aviso, Boton, Campo } from '../../components/ui';
import { MARCA } from '../../config/marca';
import { useSesion, useTitulo } from '../../hooks/useSesion';
import { MODO_DEMO } from '../../api/demo';
import { USUARIOS_DEMO } from '../../api/simulacion/permisos';

// Solo rutas internas del panel (evita redirecciones a sitios externos)
function destinoSeguro(valor: string | null): string {
  return valor && valor.startsWith('/panel') && !valor.startsWith('//') ? valor : '/panel';
}

export default function Ingresar() {
  useTitulo('Ingresar al panel');
  const sesion = useSesion();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    // En la demostración los botones de acceso rápido envían su propio usuario de ejemplo
    mutationFn: (demo?: { email: string; password: string }) =>
      sesionApi.login(demo?.email ?? email.trim(), demo?.password ?? password),
    onSuccess: (r) => {
      setPassword('');
      guardarSesion({ token: r.token, expiraEn: r.expiraEn, usuario: r.usuario });
    },
  });

  if (sesion) return <Navigate to={destinoSeguro(params.get('volver'))} replace />;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(undefined);
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-hierro px-4 py-10">
      <div className="w-full max-w-sm rounded-lg bg-cal p-6 sm:p-8">
        <p className="font-display text-2xl">{MARCA.nombre}</p>
        <h1 className="mt-1 font-sans text-lg font-semibold text-hierro-2">Panel del personal</h1>
        <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
          <Campo
            etiqueta="Correo"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {params.get('volver') && !login.isError && (
            <p className="text-sm text-piedra">Inicia sesión para continuar.</p>
          )}
          {login.isError && <Aviso tono="error">{mensajeDeError(login.error)}</Aviso>}
          <Boton type="submit" cargando={login.isPending}>
            Ingresar
          </Boton>
        </form>
        {MODO_DEMO && (
          <div className="mt-6 rounded-md bg-ocre-claro p-4 text-sm text-ocre-texto">
            <p className="font-semibold">Demostración con datos de ejemplo</p>
            <p className="mt-1">
              Entra con un clic y compara lo que ve cada rol. Nada se envía al hotel.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {USUARIOS_DEMO.map((u) => (
                <Boton
                  key={u.email}
                  variante="secundario"
                  disabled={login.isPending}
                  onClick={() => login.mutate({ email: u.email, password: 'demo' })}
                >
                  Entrar como {u.rol === 'administrador' ? 'Administración' : 'Recepción'}
                </Boton>
              ))}
            </div>
          </div>
        )}
        <a href="/" className="mt-6 inline-block text-sm text-porton underline underline-offset-4">
          Volver al sitio
        </a>
      </div>
    </main>
  );
}
