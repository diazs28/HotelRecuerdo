import { useEffect, useSyncExternalStore } from 'react';
import { limpiarSesion, sesionActual, suscribirSesion } from '../api/session';

// Sesión reactiva: el componente se vuelve a renderizar al iniciar, cerrar o vencer la sesión
export function useSesion() {
  const sesion = useSyncExternalStore((avisar) => suscribirSesion(avisar), sesionActual);

  // Cierre automático a la hora de vencimiento del token
  useEffect(() => {
    if (!sesion) return;
    const restante = Date.parse(sesion.expiraEn) - Date.now();
    if (!Number.isFinite(restante)) return;
    const t = setTimeout(
      () => limpiarSesion('expirada'),
      Math.min(Math.max(restante, 0), 2 ** 31 - 1),
    );
    return () => clearTimeout(t);
  }, [sesion]);

  return sesion;
}

// La interfaz oculta lo que no se puede hacer; el servidor lo valida siempre
export function usePermiso(permiso: string): boolean {
  const sesion = useSesion();
  return sesion?.usuario.permisos.includes(permiso) ?? false;
}

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Hotel El Recuerdo` : 'Hotel El Recuerdo · Popayán';
  }, [titulo]);
}
