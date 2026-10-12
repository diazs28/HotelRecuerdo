// Texturas de la maqueta dibujadas en un canvas (sin imágenes externas)

import * as THREE from 'three';

// Piso de tablas de madera
export function texturaPiso(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  const filas = 10;
  const alto = c.height / filas;
  for (let f = 0; f < filas; f++) {
    let x = -((f * 97) % 180);
    while (x < c.width) {
      const largo = 160 + ((f * 31 + x) % 90);
      const tono = 38 + ((f * 13 + Math.abs(x)) % 9);
      g.fillStyle = `hsl(26 42% ${tono}%)`;
      g.fillRect(x, f * alto, largo, alto);
      g.fillStyle = 'rgb(0 0 0 / 0.35)';
      g.fillRect(x, f * alto, 2, alto);
      x += largo;
    }
    g.fillStyle = 'rgb(0 0 0 / 0.4)';
    g.fillRect(0, f * alto, c.width, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function texturaCielo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d')!;
  const cielo = g.createLinearGradient(0, 0, 0, c.height);
  cielo.addColorStop(0, '#0b1830');
  cielo.addColorStop(0.75, '#26406a');
  cielo.addColorStop(1, '#4a5f86');
  g.fillStyle = cielo;
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgb(255 255 255 / ${0.3 + ((i * 37) % 60) / 100})`;
    g.fillRect((i * 151) % c.width, (i * 89) % (c.height * 0.6), 2, 2);
  }
  // Tejados y una torre: silueta de la Ciudad Blanca de noche
  g.fillStyle = '#070b10';
  g.beginPath();
  g.moveTo(0, c.height);
  const techos: Array<[number, number, number]> = [
    [0, 230, 90],
    [90, 210, 120],
    [210, 240, 70],
    [280, 200, 110],
    [390, 225, 122],
  ];
  techos.forEach(([x, y, w]) => {
    g.lineTo(x, y + 18);
    g.lineTo(x + w / 2, y);
    g.lineTo(x + w, y + 18);
  });
  g.lineTo(c.width, c.height);
  g.fill();
  g.fillRect(318, 120, 34, 110);
  g.beginPath();
  g.moveTo(312, 122);
  g.lineTo(335, 92);
  g.lineTo(358, 122);
  g.fill();
  g.fillStyle = '#ffc477';
  [
    [40, 262],
    [128, 250],
    [150, 270],
    [300, 245],
    [430, 262],
    [460, 250],
  ].forEach(([x, y]) => g.fillRect(x!, y!, 7, 9));
  g.beginPath();
  g.arc(335, 150, 7, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cuadro con el año de origen de la casa
export function texturaCuadro(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#a8741a';
  g.fillRect(0, 0, 256, 192);
  g.strokeStyle = '#f3efe4';
  g.lineWidth = 3;
  g.strokeRect(14, 14, 228, 164);
  g.fillStyle = '#f3efe4';
  g.font = '64px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('1979', 128, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
