// Renders de la maqueta para el carrusel de cada tarjeta. Se usa UN solo contexto WebGL para
// todas las habitaciones (los navegadores limitan cuántos puede haber a la vez): cada vista se
// dibuja, se convierte en imagen y el carrusel la muestra como una foto más.

import * as THREE from 'three';
import type { FichaHabitacion } from '../../../config/habitaciones';
import { crearMaqueta, crearRenderer } from './maqueta';

export interface ImagenVista {
  id: string;
  nombre: string;
  url: string;
}

const ANCHO = 1080;
const ALTO = 720;

let renderer: THREE.WebGLRenderer | null = null;
let cola: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<ImagenVista[]>>();

const siguienteCuadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function aImagen(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolver, rechazar) => {
    canvas.toBlob(
      (blob) => (blob ? resolver(URL.createObjectURL(blob)) : rechazar(new Error('Sin imagen'))),
      'image/webp',
      0.88,
    );
  });
}

async function renderizar(ficha: FichaHabitacion): Promise<ImagenVista[]> {
  if (!renderer) {
    renderer = crearRenderer({ conservar: true });
    renderer.setPixelRatio(1);
    renderer.setSize(ANCHO, ALTO, false);
  }
  const escena = new THREE.Scene();
  const maqueta = crearMaqueta(ficha);
  escena.add(maqueta.grupo);
  const camara = new THREE.PerspectiveCamera(38, ANCHO / ALTO, 0.1, 100);

  const imagenes: ImagenVista[] = [];
  try {
    for (const v of maqueta.vistas) {
      camara.fov = v.id === 'plano' ? 44 : v.id === 'general' ? 38 : 52;
      camara.updateProjectionMatrix();
      camara.position.set(...v.camara);
      camara.lookAt(...v.objetivo);
      renderer.render(escena, camara);
      imagenes.push({ id: v.id, nombre: v.nombre, url: await aImagen(renderer.domElement) });
      // Un respiro entre renders para no congelar el desplazamiento de la página
      await siguienteCuadro();
    }
  } finally {
    maqueta.liberar();
  }
  return imagenes;
}

// Devuelve (y recuerda) las vistas de una ficha; las peticiones se atienden en fila
export function vistasDe(ficha: FichaHabitacion): Promise<ImagenVista[]> {
  const previa = cache.get(ficha.clave);
  if (previa) return previa;
  const promesa = cola.then(() => renderizar(ficha));
  cola = promesa.catch(() => undefined);
  cache.set(ficha.clave, promesa);
  promesa.catch(() => cache.delete(ficha.clave));
  return promesa;
}
