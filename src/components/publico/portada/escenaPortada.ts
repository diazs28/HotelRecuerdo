// Escena 3D de la portada: la calle de la Ciudad Blanca dibujada con luz que se construye desde
// el suelo, ventanas que se encienden, luna, estrellas y brasas que suben (el horno de 1979).
// El puntero mueve la cámara; el avance del scroll la hace entrar por el portón de El Recuerdo.

import * as THREE from 'three';
import { crearCalle, ordenarParaTrazo } from './calle';

export interface Portada {
  establecerAvance: (avance: number) => void;
  pausar: (pausada: boolean) => void;
  liberar: () => void;
}

const DURACION_TRAZO = 2.8;

function texturaCirculo(colorCentro: string, tam = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d')!;
  const d = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  d.addColorStop(0, colorCentro);
  d.addColorStop(0.35, colorCentro.replace('1)', '0.45)'));
  d.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, tam, tam);
  return new THREE.CanvasTexture(c);
}

export function crearPortada(canvas: HTMLCanvasElement, opciones: { reducido: boolean }): Portada {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2('#070b10', 0.032);
  const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const liberables: Array<{ dispose: () => void }> = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (liberables.push(x), x);

  // ---------- Calle de líneas ----------
  const calle = crearCalle();
  const lineas = (segmentos: number[], color: string, opacidad: number) => {
    const geo = guardar(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(ordenarParaTrazo(segmentos), 3));
    const mat = guardar(
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacidad, fog: true }),
    );
    const obj = new THREE.LineSegments(geo, mat);
    escena.add(obj);
    return { geo, mat, vertices: segmentos.length / 3 };
  };
  const blancos = lineas(calle.blancos, '#f3efe4', 0.6);
  const calidos = lineas(calle.calidos, '#ffc477', 0.8);

  // Ventanas encendidas (se prenden una a una al terminar el trazo)
  const matVentana = guardar(
    new THREE.MeshBasicMaterial({
      color: '#f0a04b',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const ventanas = calle.ventanas.map((v, i) => {
    const m = new THREE.Mesh(guardar(new THREE.PlaneGeometry(v.ancho, v.alto)), matVentana.clone());
    guardar(m.material);
    m.position.set(v.x, v.y, 0.01);
    escena.add(m);
    return { malla: m, encendida: (i * 7) % 3 !== 0, retraso: (i * 0.37) % 2.2 };
  });

  // Rejilla del suelo
  const rejilla = new THREE.GridHelper(120, 120, '#f0a04b', '#f3efe4');
  const matRejilla = rejilla.material as THREE.Material;
  matRejilla.transparent = true;
  matRejilla.opacity = 0.08;
  guardar(rejilla.geometry);
  guardar(matRejilla);
  escena.add(rejilla);

  // Luna
  const luna = new THREE.Sprite(
    guardar(
      new THREE.SpriteMaterial({
        map: guardar(texturaCirculo('rgba(243,239,228,1)', 128)),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  luna.position.set(13, 15, -40);
  luna.scale.setScalar(14);
  escena.add(luna);

  // Estrellas
  const nEstrellas = 700;
  const estrellas = new Float32Array(nEstrellas * 3);
  for (let i = 0; i < nEstrellas; i++) {
    estrellas[i * 3] = (Math.random() - 0.5) * 160;
    estrellas[i * 3 + 1] = 6 + Math.random() * 50;
    estrellas[i * 3 + 2] = -30 - Math.random() * 60;
  }
  const geoEstrellas = guardar(new THREE.BufferGeometry());
  geoEstrellas.setAttribute('position', new THREE.BufferAttribute(estrellas, 3));
  const puntoBlanco = guardar(texturaCirculo('rgba(255,255,255,1)'));
  const cielo = new THREE.Points(
    geoEstrellas,
    guardar(
      new THREE.PointsMaterial({
        size: 0.35,
        map: puntoBlanco,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  escena.add(cielo);

  // Brasas que suben desde la calle
  const nBrasas = opciones.reducido ? 0 : 140;
  const brasas = new Float32Array(nBrasas * 3);
  const velocidades = new Float32Array(nBrasas);
  const reiniciar = (i: number, alturaAleatoria: boolean) => {
    brasas[i * 3] = (Math.random() - 0.5) * 30;
    brasas[i * 3 + 1] = alturaAleatoria ? Math.random() * 12 : -0.5;
    brasas[i * 3 + 2] = -4 + Math.random() * 12;
    velocidades[i] = 0.25 + Math.random() * 0.6;
  };
  for (let i = 0; i < nBrasas; i++) reiniciar(i, true);
  const geoBrasas = guardar(new THREE.BufferGeometry());
  geoBrasas.setAttribute('position', new THREE.BufferAttribute(brasas, 3));
  escena.add(
    new THREE.Points(
      geoBrasas,
      guardar(
        new THREE.PointsMaterial({
          size: 0.22,
          map: guardar(texturaCirculo('rgba(255,170,80,1)')),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    ),
  );

  // ---------- Cámara: puntero + avance del scroll ----------
  const puntero = { x: 0, y: 0 };
  const alMoverPuntero = (e: PointerEvent) => {
    puntero.x = (e.clientX / window.innerWidth) * 2 - 1;
    puntero.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', alMoverPuntero, { passive: true });
  let avance = 0;
  const objetivo = new THREE.Vector3();
  const mirar = new THREE.Vector3();
  const { x: px, y: py } = calle.porton;

  const ajustar = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    // En pantallas angostas la cámara se aleja para que la calle quepa
    camara.fov = w < h ? 62 : 42;
    camara.updateProjectionMatrix();
  };
  let listo = false;
  const observador = new ResizeObserver(() => {
    ajustar();
    // Con movimiento reducido no hay bucle: se vuelve a dibujar al cambiar el tamaño
    if (opciones.reducido && listo) dibujar();
  });
  observador.observe(canvas);
  ajustar();

  // En pantallas anchas la calle se corre a la derecha para dejar aire al título
  const lejania = () => (camara.aspect < 1 ? 34 : 25);
  const corrimiento = () => (camara.aspect < 1 ? 0 : -5);
  camara.position.set(corrimiento(), 3, lejania());

  // ---------- Bucle ----------
  const reloj = new THREE.Timer();
  let tiempo = opciones.reducido ? DURACION_TRAZO + 3 : 0;
  let pausada = false;
  let cuadro = 0;

  const dibujar = () => {
    reloj.update();
    const dt = Math.min(reloj.getDelta(), 0.05);
    tiempo += dt;

    const t = Math.min(1, tiempo / DURACION_TRAZO);
    const suave = 1 - Math.pow(1 - t, 3);
    blancos.geo.setDrawRange(0, Math.floor((blancos.vertices * suave) / 2) * 2);
    const tc = Math.min(1, Math.max(0, (tiempo - 0.9) / DURACION_TRAZO));
    calidos.geo.setDrawRange(0, Math.floor((calidos.vertices * tc) / 2) * 2);

    ventanas.forEach((v) => {
      const mat = v.malla.material as THREE.MeshBasicMaterial;
      const encender = tiempo - DURACION_TRAZO - v.retraso;
      const base = v.encendida ? 0.24 : 0.05;
      const parpadeo = opciones.reducido ? 0 : Math.sin(tiempo * 3 + v.retraso * 9) * 0.03;
      mat.opacity = encender > 0 ? Math.min(base, encender * 0.4) + parpadeo : 0;
    });

    for (let i = 0; i < nBrasas; i++) {
      brasas[i * 3 + 1]! += velocidades[i]! * dt;
      brasas[i * 3]! += Math.sin(tiempo * 0.8 + i) * dt * 0.3;
      if (brasas[i * 3 + 1]! > 14) reiniciar(i, false);
    }
    if (nBrasas) geoBrasas.attributes.position!.needsUpdate = true;
    cielo.rotation.y = tiempo * 0.004;

    // La cámara se acerca al portón con el scroll y se mece con el puntero
    const lejos = lejania();
    const z = lejos - avance * (lejos - 2.2);
    objetivo.set(
      corrimiento() * (1 - avance) + px * avance + puntero.x * 1.6 * (1 - avance),
      3 - avance * 1.3 - puntero.y * 0.7 * (1 - avance),
      z,
    );
    camara.position.lerp(objetivo, opciones.reducido ? 1 : 0.06);
    mirar.set(corrimiento() * (1 - avance) + px * avance, 3.4 + (py - 3.4) * avance, 0);
    camara.lookAt(mirar);
    const desvanecer = 1 - Math.max(0, (avance - 0.55) / 0.45);
    blancos.mat.opacity = 0.6 * desvanecer;
    calidos.mat.opacity = 0.8 * desvanecer;

    renderer.render(escena, camara);
    // Con movimiento reducido se dibuja una sola vez (y otra al cambiar el tamaño o el scroll)
    if (!pausada && !opciones.reducido) cuadro = requestAnimationFrame(dibujar);
  };
  dibujar();
  listo = true;

  return {
    establecerAvance: (a) => {
      avance = Math.min(1, Math.max(0, a));
      if (opciones.reducido) dibujar();
    },
    pausar: (p) => {
      if (p === pausada) return;
      pausada = p;
      if (!p && !opciones.reducido) {
        reloj.update();
        cuadro = requestAnimationFrame(dibujar);
      } else if (p) cancelAnimationFrame(cuadro);
    },
    liberar: () => {
      pausada = true;
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      window.removeEventListener('pointermove', alMoverPuntero);
      liberables.forEach((x) => x.dispose());
      renderer.dispose();
    },
  };
}
