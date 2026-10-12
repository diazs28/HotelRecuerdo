// Escena interactiva del explorador 3D: la maqueta se gira arrastrando, se acerca con la rueda o
// pellizcando, y la cámara "vuela" entre vistas y puntos de interés.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FichaHabitacion } from '../../../config/habitaciones';
import { gsap } from '../../../lib/gsap';
import { crearMaqueta, crearRenderer, type PuntoInteres, type Vista } from './maqueta';

export interface PosicionPunto {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface Explorador {
  vistas: Vista[];
  puntos: PuntoInteres[];
  irA: (vista: Vista) => void;
  liberar: () => void;
}

export function crearExplorador(
  canvas: HTMLCanvasElement,
  ficha: FichaHabitacion,
  opciones: { reducido: boolean; alMover: (puntos: PosicionPunto[]) => void },
): Explorador {
  const renderer = crearRenderer({ canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  const escena = new THREE.Scene();
  const maqueta = crearMaqueta(ficha);
  escena.add(maqueta.grupo);

  const camara = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  const inicial = maqueta.vistas[0]!;
  camara.position.set(...inicial.camara);

  const controles = new OrbitControls(camara, canvas);
  controles.target.set(...inicial.objetivo);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.minDistance = 1.2;
  controles.maxDistance = camara.position.distanceTo(controles.target) * 1.6;
  controles.maxPolarAngle = Math.PI / 2.08;
  controles.autoRotate = !opciones.reducido;
  controles.autoRotateSpeed = 0.6;
  controles.addEventListener('start', () => {
    controles.autoRotate = false;
    gsap.killTweensOf([camara.position, controles.target]);
  });

  // Tamaño del lienzo según su contenedor
  const ajustar = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(ajustar);
  observador.observe(canvas);
  ajustar();

  // Posición en pantalla de cada punto de interés (para los botones HTML sobre el lienzo)
  const v = new THREE.Vector3();
  const proyectar = (): PosicionPunto[] =>
    maqueta.puntos.map((p) => {
      v.set(...p.posicion).project(camara);
      return {
        id: p.id,
        x: ((v.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - v.y) / 2) * canvas.clientHeight,
        visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05,
      };
    });

  let activo = true;
  let cuadro = 0;
  const animar = () => {
    if (!activo) return;
    controles.update();
    renderer.render(escena, camara);
    opciones.alMover(proyectar());
    cuadro = requestAnimationFrame(animar);
  };
  animar();

  const irA = (vista: Vista) => {
    controles.autoRotate = false;
    gsap.killTweensOf([camara.position, controles.target]);
    const duracion = opciones.reducido ? 0 : 1.4;
    const curva = 'power3.inOut';
    const [cx, cy, cz] = vista.camara;
    const [ox, oy, oz] = vista.objetivo;
    gsap.to(camara.position, { x: cx, y: cy, z: cz, duration: duracion, ease: curva });
    gsap.to(controles.target, { x: ox, y: oy, z: oz, duration: duracion, ease: curva });
  };

  return {
    vistas: maqueta.vistas,
    puntos: maqueta.puntos,
    irA,
    liberar: () => {
      activo = false;
      cancelAnimationFrame(cuadro);
      gsap.killTweensOf([camara.position, controles.target]);
      observador.disconnect();
      controles.dispose();
      maqueta.liberar();
      renderer.dispose();
    },
  };
}
