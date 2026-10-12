import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { MARCA } from '../../config/marca';
import { publico } from '../../api/endpoints';
import { cx } from '../ui';

const SECCIONES = [
  { href: '/#historia', texto: 'Historia' },
  { href: '/#alojamiento', texto: 'Alojamiento' },
  { href: '/#restaurante', texto: 'Restaurante y pizzería' },
  { href: '/#contacto', texto: 'Contacto' },
];

export function useDatosPublicos() {
  return useQuery({ queryKey: ['publico', 'hotel'], queryFn: publico.hotel, staleTime: 60_000 });
}

export function LayoutPublico() {
  const [menu, setMenu] = useState(false);
  const { data } = useDatosPublicos();
  const td = data?.ajustes.tratamiento_datos;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-hierro px-4 py-2 text-cal focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-linea bg-cal/95 backdrop-blur supports-[backdrop-filter]:bg-cal/80 sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="font-display text-xl leading-none text-hierro sm:text-2xl">
            {MARCA.nombre}
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-6 lg:flex">
            {SECCIONES.map((s) => (
              <a key={s.href} href={s.href} className="text-hierro-2 hover:text-porton">
                {s.texto}
              </a>
            ))}
            <NavLink
              to="/solicitar"
              className="rounded-md bg-porton px-4 py-2 font-semibold text-cal hover:bg-porton-2"
            >
              Solicitar disponibilidad
            </NavLink>
          </nav>
          <button
            type="button"
            className="-mr-2 rounded-md p-2 lg:hidden"
            aria-expanded={menu}
            aria-controls="menu-movil"
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
        <nav
          id="menu-movil"
          aria-label="Principal (móvil)"
          className={cx('border-t border-linea px-4 pb-4 lg:hidden', !menu && 'hidden')}
        >
          <ul className="flex flex-col">
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <a href={s.href} className="block py-3 text-lg" onClick={() => setMenu(false)}>
                  {s.texto}
                </a>
              </li>
            ))}
          </ul>
          <Link
            to="/solicitar"
            onClick={() => setMenu(false)}
            className="mt-2 block rounded-md bg-porton px-4 py-3 text-center font-semibold text-cal"
          >
            Solicitar disponibilidad
          </Link>
        </nav>
      </header>

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-hierro text-cal">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl">{MARCA.nombre}</p>
            <p className="mt-2 text-cal/80">
              {MARCA.ciudad}, {MARCA.departamento}. Hotel, restaurante y pizzería familiar desde{' '}
              {MARCA.anioOrigen}.
            </p>
          </div>
          <div>
            <p className="font-semibold">Reservas</p>
            <p className="mt-2 text-cal/80">
              Las solicitudes enviadas por este sitio no son reservas confirmadas: el equipo del
              hotel las revisa y responde.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/privacidad" className="underline underline-offset-4 hover:text-ocre-claro">
              Tratamiento de datos personales
            </Link>
            {td?.responsable && <p className="text-cal/80">Responsable: {td.responsable}</p>}
            <Link to="/panel" className="text-cal/70 underline underline-offset-4 hover:text-cal">
              Acceso del personal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
