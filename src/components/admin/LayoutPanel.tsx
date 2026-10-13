import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { sesionApi } from '../../api/endpoints';
import { actualizarUsuarioSesion, limpiarSesion } from '../../api/session';
import { useSesion } from '../../hooks/useSesion';
import { MARCA } from '../../config/marca';
import { cx } from '../ui';
import { MODO_DEMO } from '../../api/demo';

const MENU: Array<{ a: string; texto: string; permiso?: string; fin?: boolean }> = [
  { a: '/panel', texto: 'Tablero', permiso: 'tablero:ver', fin: true },
  { a: '/panel/reservas', texto: 'Reservas', permiso: 'reservas:ver' },
  { a: '/panel/ocupacion', texto: 'Ocupación de camas', permiso: 'habitaciones:ver' },
  { a: '/panel/habitaciones', texto: 'Habitaciones y camas', permiso: 'habitaciones:ver' },
  { a: '/panel/huespedes', texto: 'Huéspedes', permiso: 'reservas:ver' },
  { a: '/panel/configuracion', texto: 'Datos del hotel', permiso: 'configuracion:gestionar' },
  { a: '/panel/usuarios', texto: 'Personal y permisos', permiso: 'usuarios:gestionar' },
  { a: '/panel/auditoria', texto: 'Auditoría', permiso: 'auditoria:ver' },
  { a: '/panel/cuenta', texto: 'Mi cuenta' },
];

// Demostración: vuelve a los datos de ejemplo iniciales
async function reiniciarDemo() {
  const { reiniciarDb } = await import('../../api/simulacion/almacen');
  reiniciarDb();
  window.location.reload();
}

export default function LayoutPanel() {
  const sesion = useSesion();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const permisos = sesion?.usuario.permisos ?? [];

  // Permisos frescos al entrar (un administrador pudo cambiarlos)
  useEffect(() => {
    sesionApi
      .me()
      .then((r) => actualizarUsuarioSesion(r.usuario))
      .catch(() => undefined);
  }, []);
  useEffect(() => setMenu(false), [pathname]);

  const salir = async () => {
    await sesionApi.logout().catch(() => undefined);
    limpiarSesion('cierre');
    qc.clear();
    navegar('/panel/ingresar', { replace: true });
  };

  const enlaces = MENU.filter((m) => !m.permiso || permisos.includes(m.permiso));

  const navegacion = (
    <nav aria-label="Panel">
      <ul className="flex flex-col gap-0.5">
        {enlaces.map((m) => (
          <li key={m.a}>
            <NavLink
              to={m.a}
              end={m.fin}
              className={({ isActive }) =>
                cx(
                  'block rounded-md px-3 py-2.5 text-base',
                  isActive ? 'bg-porton text-cal font-semibold' : 'text-cal/85 hover:bg-white/10',
                )
              }
            >
              {m.texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#contenido-panel"
        className="sr-only z-50 rounded-md bg-hierro px-4 py-2 text-cal focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <aside className="bg-hierro text-cal lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="font-display text-xl leading-tight">{MARCA.nombre}</p>
            <p className="text-sm text-cal/70">Panel del personal</p>
          </div>
          <button
            type="button"
            className="rounded-md p-2 lg:hidden"
            aria-expanded={menu}
            aria-controls="menu-panel"
            onClick={() => setMenu((m) => !m)}
          >
            <span className="sr-only">{menu ? 'Cerrar menú' : 'Abrir menú'}</span>
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
              <path
                d={menu ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div id="menu-panel" className={cx('px-3 pb-4 lg:block', !menu && 'hidden')}>
          {navegacion}
          <div className="mt-6 border-t border-white/15 px-3 pt-4 text-sm">
            <p className="font-semibold">{sesion?.usuario.nombre}</p>
            <p className="text-cal/70">{sesion?.usuario.rol.nombre}</p>
            {MODO_DEMO && (
              <div className="mt-3 rounded-md bg-white/10 p-2 text-xs text-cal/85">
                Demostración con datos de ejemplo: los cambios se guardan solo en esta pestaña.
                <button
                  type="button"
                  onClick={reiniciarDemo}
                  className="mt-1 block font-semibold text-cal underline underline-offset-4"
                >
                  Reiniciar datos de ejemplo
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={salir}
              className="mt-3 rounded-md py-1 text-cal underline underline-offset-4"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <main id="contenido-panel" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
