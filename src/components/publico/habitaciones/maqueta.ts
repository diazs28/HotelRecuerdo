// Maqueta 3D ILUSTRATIVA de una habitación, construida en código (sin modelos externos).
// Es una "casa de muñecas": piso y dos muros (fondo e izquierdo) para ver el interior desde
// cualquier ángulo. El número de camas sale de la ficha (config/habitaciones.ts); el resto del
// mobiliario es genérico y el sitio lo presenta como ilustración, no como la distribución real.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FichaHabitacion } from '../../../config/habitaciones';
import { texturaCielo, texturaCuadro, texturaPiso } from './texturas';

export type Tripleta = [number, number, number];

export interface Vista {
  id: string;
  nombre: string;
  camara: Tripleta;
  objetivo: Tripleta;
}

export interface PuntoInteres {
  id: string;
  nombre: string;
  texto: string;
  posicion: Tripleta;
  vista: Vista;
}

export interface Maqueta {
  grupo: THREE.Group;
  vistas: Vista[];
  puntos: PuntoInteres[];
  liberar: () => void;
}

const ALTO = 2.6;
const GROSOR = 0.12;
const FONDO = 4.2;
const ANCHO_CAMA = 1;
const LARGO_CAMA = 2;
const ENTRE_CAMAS = 0.55;
const FONDO_ARMARIO = 0.6;

export function crearMaqueta(ficha: FichaHabitacion): Maqueta {
  const grupo = new THREE.Group();
  const liberables: Array<{ dispose: () => void }> = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => {
    liberables.push(x);
    return x;
  };

  const n = Math.max(1, Math.min(ficha.camas, 6));
  const ancho = Math.max(3.4, FONDO_ARMARIO + 0.45 + n * ANCHO_CAMA + n * ENTRE_CAMAS + 0.35);
  const x0 = -ancho / 2;
  const z0 = -FONDO / 2;

  // ---------- Materiales ----------
  const cal = guardar(new THREE.MeshStandardMaterial({ color: '#f1ede3', roughness: 0.95 }));
  const madera = guardar(new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 0.7 }));
  const maderaClara = guardar(
    new THREE.MeshStandardMaterial({ color: '#8d6a4b', roughness: 0.75 }),
  );
  const porton = guardar(new THREE.MeshStandardMaterial({ color: '#24533f', roughness: 0.6 }));
  const tela = guardar(new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 1 }));
  const acento = guardar(new THREE.MeshStandardMaterial({ color: ficha.acento, roughness: 0.95 }));
  const laton = guardar(
    new THREE.MeshStandardMaterial({ color: '#c99a4a', metalness: 0.8, roughness: 0.35 }),
  );
  const pantalla = guardar(
    new THREE.MeshStandardMaterial({
      color: '#ffe2b0',
      emissive: '#ffb257',
      emissiveIntensity: 1.6,
      side: THREE.DoubleSide,
    }),
  );
  const zocalo = guardar(new THREE.MeshStandardMaterial({ color: '#0f1820', roughness: 0.5 }));
  const bordes = guardar(
    new THREE.LineBasicMaterial({ color: '#ffc477', transparent: true, opacity: 0.4 }),
  );

  const caja = (
    material: THREE.Material,
    tam: Tripleta,
    pos: Tripleta,
    opciones: { sombra?: boolean; bordes?: boolean; redondeo?: number } = {},
  ) => {
    const geo = guardar(
      opciones.redondeo
        ? new RoundedBoxGeometry(tam[0], tam[1], tam[2], 3, opciones.redondeo)
        : new THREE.BoxGeometry(...tam),
    );
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    m.castShadow = opciones.sombra ?? true;
    m.receiveShadow = true;
    if (opciones.bordes) {
      const lineas = new THREE.LineSegments(guardar(new THREE.EdgesGeometry(geo)), bordes);
      m.add(lineas);
    }
    grupo.add(m);
    return m;
  };

  // Muro entre dos puntos (en x o en z), de y1 a y2
  const muroFondo = (xa: number, xb: number, ya: number, yb: number) =>
    caja(cal, [xb - xa, yb - ya, GROSOR], [(xa + xb) / 2, (ya + yb) / 2, z0 - GROSOR / 2], {
      bordes: true,
    });
  const muroIzquierdo = (za: number, zb: number, ya: number, yb: number) =>
    caja(cal, [GROSOR, yb - ya, zb - za], [x0 - GROSOR / 2, (ya + yb) / 2, (za + zb) / 2], {
      bordes: true,
    });

  // ---------- Base y piso ----------
  const base = caja(zocalo, [ancho + 0.9, 0.3, FONDO + 0.9], [0.12, -0.25, 0.12], {
    sombra: false,
  });
  base.add(
    new THREE.LineSegments(
      guardar(new THREE.EdgesGeometry(base.geometry)),
      guardar(new THREE.LineBasicMaterial({ color: '#f0a04b', transparent: true, opacity: 0.7 })),
    ),
  );
  const tPiso = guardar(texturaPiso());
  tPiso.repeat.set(ancho / 2.4, FONDO / 2.4);
  const piso = guardar(new THREE.MeshStandardMaterial({ map: tPiso, roughness: 0.6 }));
  caja(piso, [ancho, 0.1, FONDO], [0, -0.05, 0], { sombra: false });

  // ---------- Camas, mesas de noche y lámparas ----------
  const inicioCamas = x0 + FONDO_ARMARIO + 0.45;
  const centrosCamas: number[] = [];
  const lamparas: Tripleta[] = [];
  for (let i = 0; i < n; i++) {
    const cx = inicioCamas + i * (ANCHO_CAMA + ENTRE_CAMAS) + ANCHO_CAMA / 2;
    const cz = z0 + 0.06 + LARGO_CAMA / 2;
    centrosCamas.push(cx);
    caja(madera, [ANCHO_CAMA + 0.1, 1, 0.06], [cx, 0.5, z0 + 0.03], { bordes: false });
    caja(madera, [ANCHO_CAMA, 0.3, LARGO_CAMA], [cx, 0.15, cz]);
    caja(tela, [ANCHO_CAMA - 0.04, 0.2, LARGO_CAMA - 0.06], [cx, 0.4, cz], { redondeo: 0.06 });
    caja(acento, [ANCHO_CAMA + 0.04, 0.09, 1.3], [cx, 0.5, cz + 0.36], { redondeo: 0.035 });
    caja(tela, [ANCHO_CAMA + 0.05, 0.1, 0.18], [cx, 0.51, cz - 0.3], { redondeo: 0.04 });
    caja(tela, [0.68, 0.14, 0.36], [cx, 0.57, z0 + 0.34], { redondeo: 0.065 });

    const mx = cx + ANCHO_CAMA / 2 + ENTRE_CAMAS / 2;
    caja(maderaClara, [0.42, 0.52, 0.4], [mx, 0.26, z0 + 0.24]);
    caja(laton, [0.05, 0.22, 0.05], [mx, 0.63, z0 + 0.24]);
    const pantallaGeo = guardar(new THREE.CylinderGeometry(0.09, 0.14, 0.18, 24, 1, true));
    const p = new THREE.Mesh(pantallaGeo, pantalla);
    p.position.set(mx, 0.8, z0 + 0.24);
    grupo.add(p);
    lamparas.push([mx, 0.8, z0 + 0.24]);
    if (i < 3) {
      const luz = new THREE.PointLight('#ffb15e', 1.4, 3.2, 2);
      luz.position.set(mx, 0.85, z0 + 0.35);
      grupo.add(luz);
    }
  }
  const centroCamas = (centrosCamas[0]! + centrosCamas[centrosCamas.length - 1]!) / 2;

  // Tapete frente a las camas
  caja(acento, [Math.min(2.2, n * 1.2), 0.012, 1], [centroCamas, 0.006, z0 + 2.75], {
    sombra: false,
  });

  // ---------- Muro del fondo con ventana y postigos ----------
  const anchoVentana = 1.3;
  const xv = centroCamas;
  const yAlfeizar = 1.15;
  const yDintel = 2.25;
  muroFondo(x0 - GROSOR, xv - anchoVentana / 2, 0, ALTO);
  muroFondo(xv + anchoVentana / 2, -x0, 0, ALTO);
  muroFondo(xv - anchoVentana / 2, xv + anchoVentana / 2, 0, yAlfeizar);
  muroFondo(xv - anchoVentana / 2, xv + anchoVentana / 2, yDintel, ALTO);
  const altoVentana = yDintel - yAlfeizar;
  const yv = (yAlfeizar + yDintel) / 2;
  caja(madera, [anchoVentana + 0.1, 0.06, 0.18], [xv, yAlfeizar, z0 + 0.02]);
  caja(madera, [anchoVentana, 0.05, 0.08], [xv, yDintel - 0.025, z0 - 0.04]);
  caja(madera, [0.05, altoVentana, 0.08], [xv - anchoVentana / 2 + 0.025, yv, z0 - 0.04]);
  caja(madera, [0.05, altoVentana, 0.08], [xv + anchoVentana / 2 - 0.025, yv, z0 - 0.04]);
  caja(madera, [0.04, altoVentana, 0.06], [xv, yv, z0 - 0.04]);
  const vidrio = guardar(
    new THREE.MeshStandardMaterial({
      color: '#9cc3ff',
      emissive: '#203a66',
      transparent: true,
      opacity: 0.28,
    }),
  );
  caja(vidrio, [anchoVentana - 0.05, altoVentana, 0.01], [xv, yv, z0 - 0.05], { sombra: false });
  // Postigos verdes abiertos contra el muro, como en las casas de Popayán
  caja(porton, [anchoVentana / 2, altoVentana, 0.04], [xv - anchoVentana * 0.78, yv, z0 + 0.03]);
  caja(porton, [anchoVentana / 2, altoVentana, 0.04], [xv + anchoVentana * 0.78, yv, z0 + 0.03]);
  const tCielo = guardar(texturaCielo());
  const cielo = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(2.6, 1.6)),
    guardar(new THREE.MeshBasicMaterial({ map: tCielo })),
  );
  cielo.position.set(xv, yv, z0 - GROSOR - 0.5);
  grupo.add(cielo);

  // ---------- Muro izquierdo con puerta ----------
  const zp = z0 + FONDO - 0.75;
  const anchoPuerta = 0.9;
  const altoPuerta = 2.1;
  muroIzquierdo(z0 - GROSOR, zp - anchoPuerta / 2, 0, ALTO);
  muroIzquierdo(zp + anchoPuerta / 2, z0 + FONDO, 0, ALTO);
  muroIzquierdo(zp - anchoPuerta / 2, zp + anchoPuerta / 2, altoPuerta, ALTO);
  caja(porton, [0.05, altoPuerta, anchoPuerta - 0.04], [x0 - GROSOR / 2, altoPuerta / 2, zp]);
  const pomo = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.035, 16, 12)), laton);
  pomo.position.set(x0 + 0.01, 1.02, zp + 0.3);
  grupo.add(pomo);

  // ---------- Armario en la esquina del fondo ----------
  const za = z0 + 0.7;
  caja(maderaClara, [FONDO_ARMARIO, 2.1, 1.3], [x0 + FONDO_ARMARIO / 2, 1.05, za], {
    bordes: true,
  });
  caja(madera, [0.01, 1.96, 0.012], [x0 + FONDO_ARMARIO + 0.005, 1.05, za]);
  caja(laton, [0.03, 0.22, 0.03], [x0 + FONDO_ARMARIO + 0.02, 1.1, za - 0.08]);
  caja(laton, [0.03, 0.22, 0.03], [x0 + FONDO_ARMARIO + 0.02, 1.1, za + 0.08]);

  // Cuadro con el año de origen sobre el muro izquierdo
  const tCuadro = guardar(texturaCuadro());
  const cuadro = caja(
    guardar(new THREE.MeshStandardMaterial({ map: tCuadro, roughness: 0.8 })),
    [0.03, 0.42, 0.56],
    [x0 + 0.02, 1.55, (za + 0.65 + zp - anchoPuerta / 2) / 2],
  );
  cuadro.castShadow = false;

  // ---------- Luces ----------
  grupo.add(new THREE.HemisphereLight('#dfe8ff', '#3a2a20', 1.1));
  const sol = new THREE.DirectionalLight('#ffe6c4', 2.2);
  sol.position.set(ancho * 0.6, 6, FONDO * 1.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  const s = Math.max(ancho, FONDO);
  Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 20 });
  sol.shadow.bias = -0.0008;
  sol.shadow.normalBias = 0.02;
  grupo.add(sol);
  const luna = new THREE.PointLight('#8fb8ff', 1.2, 4, 2);
  luna.position.set(xv, yv, z0 + 0.3);
  grupo.add(luna);

  // ---------- Vistas y puntos de interés ----------
  const radio = Math.max(ancho, FONDO) / 2;
  const lejos = radio * 2.15 + 2.4;
  const general: Vista = {
    id: 'general',
    nombre: 'Vista general',
    camara: [lejos * 0.58, lejos * 0.62, lejos * 0.66],
    objetivo: [0, 0.6, -0.2],
  };
  const descanso: Vista = {
    id: 'descanso',
    nombre: 'Zona de descanso',
    camara: [centroCamas + 0.6, 1.45, z0 + 3 + n * 0.55],
    objetivo: [centroCamas, 0.55, z0 + 0.9],
  };
  const ventana: Vista = {
    id: 'ventana',
    nombre: 'Ventana',
    camara: [xv + 0.35, 1.35, z0 + 2.7],
    objetivo: [xv, 1.6, z0],
  };
  const plano: Vista = {
    id: 'plano',
    nombre: 'Plano',
    camara: [0, (radio + 0.8) / Math.tan((22 * Math.PI) / 180), 0.01],
    objetivo: [0, 0, 0],
  };
  const entrada: Vista = {
    id: 'entrada',
    nombre: 'Entrada',
    camara: [x0 + 2.6, 1.55, zp + 0.9],
    objetivo: [x0, 1.05, zp],
  };
  const armario: Vista = {
    id: 'armario',
    nombre: 'Armario',
    camara: [x0 + 2.7, 1.5, za + 1.6],
    objetivo: [x0 + 0.3, 1.1, za],
  };
  const lampara = lamparas[0]!;
  const mesa: Vista = {
    id: 'mesa',
    nombre: 'Mesa de noche',
    camara: [lampara[0] + 0.9, 1.15, lampara[2] + 1.5],
    objetivo: [lampara[0], 0.55, lampara[2]],
  };

  const personas = ficha.personas === 1 ? '1 persona' : `${ficha.personas} personas`;
  const puntos: PuntoInteres[] = [
    {
      id: 'camas',
      nombre: n === 1 ? '1 cama' : `${n} camas`,
      texto: `La maqueta muestra ${n === 1 ? 'una cama' : `${n} camas`} para ${personas}. Al responder tu solicitud te confirmamos la distribución real.`,
      posicion: [centrosCamas[0]!, 0.75, z0 + 0.5],
      vista: descanso,
    },
    {
      id: 'ventana',
      nombre: 'Ventana',
      texto:
        'Postigos de madera al estilo de las casas de Popayán. La vista depende de la habitación asignada.',
      posicion: [xv, 1.75, z0 + 0.05],
      vista: ventana,
    },
    {
      id: 'mesa',
      nombre: 'Mesa de noche',
      texto: 'Una lámpara junto a cada cama para leer antes de dormir.',
      posicion: [lampara[0], 0.95, lampara[2]],
      vista: mesa,
    },
    {
      id: 'armario',
      nombre: 'Armario',
      texto: 'Espacio para el equipaje y la ropa.',
      posicion: [x0 + FONDO_ARMARIO + 0.02, 1.6, za],
      vista: armario,
    },
    {
      id: 'entrada',
      nombre: 'Entrada',
      texto: 'Puerta verde, como los portones de las casonas de la ciudad.',
      posicion: [x0 + 0.05, 1.5, zp],
      vista: entrada,
    },
  ];

  return {
    grupo,
    vistas: [general, descanso, ventana, plano],
    puntos,
    liberar: () => liberables.forEach((x) => x.dispose()),
  };
}

export function crearRenderer(
  opciones: { canvas?: HTMLCanvasElement; conservar?: boolean } = {},
): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({
    canvas: opciones.canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: opciones.conservar ?? false,
    powerPreference: 'high-performance',
  });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.setClearColor(0x000000, 0);
  return r;
}
