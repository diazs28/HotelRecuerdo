import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { ANIOS_DE_HISTORIA } from '../../config/marca';
import { Contacto } from '../../components/publico/Contacto';
import { Experiencias } from '../../components/publico/Experiencias';
import { LineaTiempo } from '../../components/publico/historia/LineaTiempo';
import { SeccionHabitaciones } from '../../components/publico/habitaciones/SeccionHabitaciones';
import { useDatosPublicos } from '../../components/publico/LayoutPublico';
import { Cinta, Portada } from '../../components/publico/portada/Portada';
import { Restaurante } from '../../components/publico/Restaurante';
import { irASeccion } from '../../hooks/useScrollSuave';
import { ScrollTrigger } from '../../lib/gsap';
import { useTitulo } from '../../hooks/useSesion';

export function Inicio() {
  useTitulo('');
  const { data } = useDatosPublicos();
  const { hash } = useLocation();
  const anios = ANIOS_DE_HISTORIA(
    Number((data?.hoy ?? String(new Date().getFullYear())).slice(0, 4)),
  );

  // Si se llega con /#seccion, se espera a que las escenas fijadas midan la página antes de ir
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => {
      ScrollTrigger.refresh();
      irASeccion(decodeURIComponent(hash.slice(1)), false);
    }, 150);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <>
      <Portada />
      <Cinta />
      <LineaTiempo anios={anios} />
      <SeccionHabitaciones datos={data} />
      <Experiencias />
      <Restaurante datos={data} />
      <Contacto datos={data} />
    </>
  );
}
