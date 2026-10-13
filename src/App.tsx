import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, RouterProvider, useLocation } from 'react-router';
import { LayoutPublico } from './components/publico/LayoutPublico';
import { Inicio } from './pages/publico/Inicio';
import { Solicitar } from './pages/publico/Solicitar';
import { Privacidad } from './pages/publico/Privacidad';
import { Cargando } from './components/ui';
import { useSesion, useTitulo } from './hooks/useSesion';

// El panel se carga aparte: quien visita el sitio público no descarga el código del panel
const LayoutPanel = lazy(() => import('./components/admin/LayoutPanel'));
const Ingresar = lazy(() => import('./pages/admin/Ingresar'));
const Tablero = lazy(() => import('./pages/admin/Tablero'));
const Reservas = lazy(() => import('./pages/admin/Reservas'));
const NuevaReserva = lazy(() => import('./pages/admin/NuevaReserva'));
const DetalleReserva = lazy(() => import('./pages/admin/DetalleReserva'));
const Ocupacion = lazy(() => import('./pages/admin/Ocupacion'));
const Habitaciones = lazy(() => import('./pages/admin/Habitaciones'));
const Huespedes = lazy(() => import('./pages/admin/Huespedes'));
const Configuracion = lazy(() => import('./pages/admin/Configuracion'));
const Usuarios = lazy(() => import('./pages/admin/Usuarios'));
const Auditoria = lazy(() => import('./pages/admin/Auditoria'));
const Cuenta = lazy(() => import('./pages/admin/Cuenta'));

function NoEncontrado() {
  useTitulo('Página no encontrada');
  return (
    <section className="mx-auto max-w-2xl px-4 py-28 sm:px-6">
      <h1 className="text-4xl">Esta página no existe</h1>
      <p className="mt-4 text-lg opacity-80">Revisa la dirección o vuelve al inicio.</p>
      <Link to="/" className="mt-6 inline-block font-semibold underline underline-offset-4">
        Ir al inicio
      </Link>
    </section>
  );
}

function ErrorRuta() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl">Algo salió mal al abrir esta página</h1>
      <p className="mt-4 text-lg text-hierro-2">
        Recarga la página. Si el problema sigue, avisa al administrador.
      </p>
      <a
        href="/"
        className="mt-6 inline-block font-semibold text-porton underline underline-offset-4"
      >
        Ir al inicio
      </a>
    </section>
  );
}

const cargar = (el: ReactNode) => (
  <Suspense
    fallback={
      <div className="px-6">
        <Cargando />
      </div>
    }
  >
    {el}
  </Suspense>
);

// Protege el panel en el navegador. La seguridad real la aplica la API en cada petición.
function ConSesion({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const { pathname, search } = useLocation();
  if (!sesion) {
    return (
      <Navigate to={`/panel/ingresar?volver=${encodeURIComponent(pathname + search)}`} replace />
    );
  }
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    element: <LayoutPublico />,
    errorElement: <ErrorRuta />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'solicitar', element: <Solicitar /> },
      { path: 'privacidad', element: <Privacidad /> },
      { path: '*', element: <NoEncontrado /> },
    ],
  },
  { path: 'panel/ingresar', element: cargar(<Ingresar />), errorElement: <ErrorRuta /> },
  {
    path: 'panel',
    errorElement: <ErrorRuta />,
    element: <ConSesion>{cargar(<LayoutPanel />)}</ConSesion>,
    children: [
      { index: true, element: cargar(<Tablero />) },
      { path: 'reservas', element: cargar(<Reservas />) },
      { path: 'reservas/nueva', element: cargar(<NuevaReserva />) },
      { path: 'reservas/:id', element: cargar(<DetalleReserva />) },
      { path: 'ocupacion', element: cargar(<Ocupacion />) },
      { path: 'habitaciones', element: cargar(<Habitaciones />) },
      { path: 'huespedes', element: cargar(<Huespedes />) },
      { path: 'configuracion', element: cargar(<Configuracion />) },
      { path: 'usuarios', element: cargar(<Usuarios />) },
      { path: 'auditoria', element: cargar(<Auditoria />) },
      { path: 'cuenta', element: cargar(<Cuenta />) },
      { path: '*', element: <NoEncontrado /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
