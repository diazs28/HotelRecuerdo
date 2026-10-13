import { useEffect, useState, type MouseEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { MARCA } from '../../config/marca';
import { publico } from '../../api/endpoints';
import { MODO_DEMO } from '../../api/demo';
import { useMovimientoReducido } from '../../hooks/useMovimientoReducido';
import { desplazarA, irASeccion, pausarScroll, useScrollSuave } from '../../hooks/useScrollSuave';
import { cx } from '../ui';
import { Icono } from './Iconos';
import { PantallaInicio } from './PantallaInicio';

const SECCIONES = [
  { id: 'historia', texto: 'Historia' },
  { id: 'habitaciones', texto: 'Habitaciones' },
  { id: 'experiencias', texto: 'Experiencias' },
  { id: 'restaurante', texto: 'Restaurante' },
  { id: 'contacto', texto: 'Contacto' },
];

export function useDatosPublicos() {
  return useQuery({ queryKey: ['publico', 'hotel'], queryFn: publico.hotel, staleTime: 60_000 });
}

// Sección del inicio que cruza el centro de la pantalla (para resaltarla en el menú)
function useSeccionActiva(enInicio: boolean): string {
  const [activa, setActiva] = useState('');
  useEffect(() => {
    if (!enInicio) return;
    const observador = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => e.isIntersecting && setActiva(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    const t = window.setTimeout(() => {
      SECCIONES.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el) observador.observe(el);
      });
    }, 300);
    return () => {
      window.clearTimeout(t);
      observador.disconnect();
      setActiva('');
    };
  }, [enInicio]);
  return activa;
}

export function LayoutPublico() {
  const [menu, setMenu] = useState(false);
  const [desplazado, setDesplazado] = useState(false);
  const { data } = useDatosPublicos();
  const { pathname, hash } = useLocation();
  const navegar = useNavigate();
  const reducido = useMovimientoReducido();
  const enInicio = pathname === '/';
  const activa = useSeccionActiva(enInicio);
  const td = data?.ajustes.tratamiento_datos;
  const anioActual = Number((data?.hoy ?? String(new Date().getFullYear())).slice(0, 4));

  useScrollSuave(!reducido);

  // Tema oscuro solo para el sitio público (el panel conserva el suyo)
  useEffect(() => {
    document.documentElement.classList.add('tema-noche');
    return () => document.documentElement.classList.remove('tema-noche');
  }, []);

  useEffect(() => {
    const marcar = () => setDesplazado(window.scrollY > 24);
    marcar();
    window.addEventListener('scroll', marcar, { passive: true });
    return () => window.removeEventListener('scroll', marcar);
  }, []);

  // Al cambiar de página se vuelve arriba (salvo que la dirección apunte a una sección)
  useEffect(() => {
    if (!hash) desplazarA(0, false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!menu) return;
    pausarScroll(true);
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', cerrar);
    return () => {
      window.removeEventListener('keydown', cerrar);
      pausarScroll(false);
    };
  }, [menu]);

  const ir = (e: MouseEvent, id: string) => {
    e.preventDefault();
    setMenu(false);
    if (enInicio && irASeccion(id)) return;
    navegar(`/#${id}`);
  };

  return (
    <div className="grano flex min-h-dvh flex-col bg-noche text-luz">
      <PantallaInicio anioActual={anioActual} />
      <a
        href="#contenido"
        className="sr-only z-[80] rounded-full bg-luz px-4 py-2 text-noche focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <header
        className={cx(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500',
          desplazado || !enInicio || menu
            ? 'border-b border-luz/10 bg-noche/70 backdrop-blur-xl'
            : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            to="/"
            viewTransition
            className="group flex items-baseline gap-3"
            onClick={() => setMenu(false)}
          >
            <span className="whitespace-nowrap font-display text-xl leading-none max-[360px]:text-lg sm:text-2xl">
              {MARCA.nombre}
            </span>
            <span className="etiqueta-hud hidden text-[0.58rem] text-niebla sm:inline">
              {MARCA.ciudad} · {MARCA.anioOrigen}
            </span>
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
            {SECCIONES.map((s) => (
              <a
                key={s.id}
                href={`/#${s.id}`}
                onClick={(e) => ir(e, s.id)}
                aria-current={activa === s.id ? 'location' : undefined}
                className={cx(
                  'relative rounded-full px-3.5 py-2 text-sm transition-colors',
                  activa === s.id ? 'text-luz' : 'text-niebla hover:text-luz',
                )}
              >
                {s.texto}
                <span
                  aria-hidden
                  className={cx(
                    'absolute inset-x-3.5 -bottom-0.5 h-px origin-left bg-brasa-2 transition-transform duration-500',
                    activa === s.id ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </a>
            ))}
            <Link
              to="/solicitar"
              viewTransition
              className="boton-brasa ml-3 inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold"
            >
              Solicitar
            </Link>
          </nav>

          <button
            type="button"
            className="-mr-2 grid size-11 place-items-center rounded-full lg:hidden"
            aria-expanded={menu}
            aria-controls="menu-movil"
            onClick={() => setMenu((m) => !m)}
          >
            <span className="sr-only">{menu ? 'Cerrar menú' : 'Abrir menú'}</span>
            <Icono nombre={menu ? 'cerrar' : 'plano'} className="size-6" />
          </button>
        </div>
      </header>

      {/* Menú móvil: cortina a pantalla completa con los enlaces escalonados */}
      <nav
        id="menu-movil"
        aria-label="Principal (móvil)"
        className={cx(
          'fixed inset-0 z-40 flex flex-col justify-between bg-noche/95 px-6 pb-10 pt-24 backdrop-blur-xl transition-[clip-path] duration-700 ease-[cubic-bezier(0.77,0,0.18,1)] lg:hidden',
          menu ? '[clip-path:inset(0_0_0_0)]' : 'pointer-events-none [clip-path:inset(0_0_100%_0)]',
        )}
        inert={!menu}
      >
        <ul className="flex flex-col gap-1">
          {SECCIONES.map((s, i) => (
            <li key={s.id} className="overflow-hidden">
              <a
                href={`/#${s.id}`}
                onClick={(e) => ir(e, s.id)}
                className={cx(
                  'flex items-baseline gap-4 py-2 font-display text-4xl transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  menu ? 'translate-y-0' : 'translate-y-full',
                )}
                style={{ transitionDelay: menu ? `${150 + i * 60}ms` : '0ms' }}
              >
                <span className="etiqueta-hud text-brasa-2">0{i + 1}</span>
                {s.texto}
              </a>
            </li>
          ))}
        </ul>
        <Link
          to="/solicitar"
          viewTransition
          onClick={() => setMenu(false)}
          className="boton-brasa flex min-h-12 items-center justify-center rounded-full px-6 text-lg font-semibold"
        >
          Solicitar disponibilidad
        </Link>
      </nav>

      {MODO_DEMO && (
        <p className="etiqueta-hud vidrio fixed bottom-3 left-3 z-40 rounded-full px-3 py-1.5 text-[0.58rem] text-brasa-2">
          Versión de demostración
        </p>
      )}

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-luz/10 bg-noche-2">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-8 pt-16 sm:px-8 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl">{MARCA.nombre}</p>
            <p className="mt-3 text-niebla">
              {MARCA.ciudad}, {MARCA.departamento}. Hotel, restaurante y pizzería familiar desde{' '}
              {MARCA.anioOrigen}.
            </p>
          </div>
          <div>
            <p className="etiqueta-hud text-brasa-2">Reservas</p>
            <p className="mt-3 text-niebla">
              Las solicitudes enviadas por este sitio no son reservas confirmadas: el equipo del
              hotel las revisa y responde.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to="/privacidad"
              viewTransition
              className="text-luz underline-offset-4 hover:underline"
            >
              Tratamiento de datos personales
            </Link>
            {td?.responsable && <p className="text-niebla">Responsable: {td.responsable}</p>}
            <Link
              to="/panel"
              className="text-niebla underline-offset-4 hover:text-luz hover:underline"
            >
              {MODO_DEMO ? 'Panel del personal (demostración)' : 'Acceso del personal'}
            </Link>
          </div>
        </div>
        <p
          aria-hidden
          className="texto-contorno pointer-events-none select-none whitespace-nowrap px-4 pb-4 text-center font-display text-[17vw] leading-[0.85]"
        >
          El Recuerdo
        </p>
      </footer>
    </div>
  );
}
