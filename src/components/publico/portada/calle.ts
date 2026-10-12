// Geometría de la calle de la portada: casas coloniales de Popayán dibujadas solo con líneas
// (muros, tejados con tejas, zócalo, portones en arco, ventanas con reja y balcones).
// Devuelve segmentos [x1, y1, z1, x2, y2, z2] y los rectángulos de las ventanas encendidas.

export interface Ventana {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface Calle {
  blancos: number[]; // muros, tejados y zócalos
  calidos: number[]; // portones, ventanas, rejas y balcones
  ventanas: Ventana[];
  porton: { x: number; y: number }; // centro del portón de El Recuerdo (destino de la cámara)
}

// Pseudoaleatorio con semilla: la calle es siempre la misma
function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PROFUNDIDAD = 5;

export function crearCalle(): Calle {
  const blancos: number[] = [];
  const calidos: number[] = [];
  const ventanas: Ventana[] = [];
  const r = azar(1979);
  const seg = (destino: number[], a: number[], b: number[]) => destino.push(...a, ...b);

  const rectangulo = (destino: number[], x1: number, y1: number, x2: number, y2: number, z = 0) => {
    seg(destino, [x1, y1, z], [x2, y1, z]);
    seg(destino, [x2, y1, z], [x2, y2, z]);
    seg(destino, [x2, y2, z], [x1, y2, z]);
    seg(destino, [x1, y2, z], [x1, y1, z]);
  };

  const arco = (destino: number[], cx: number, base: number, radio: number, z = 0) => {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a1 = Math.PI - (i / n) * Math.PI;
      const a2 = Math.PI - ((i + 1) / n) * Math.PI;
      seg(
        destino,
        [cx + Math.cos(a1) * radio, base + Math.sin(a1) * radio, z],
        [cx + Math.cos(a2) * radio, base + Math.sin(a2) * radio, z],
      );
    }
  };

  const porton = (cx: number, ancho: number, alto: number) => {
    const radio = ancho / 2;
    const base = alto - radio;
    seg(calidos, [cx - radio, 0, 0.02], [cx - radio, base, 0.02]);
    seg(calidos, [cx + radio, 0, 0.02], [cx + radio, base, 0.02]);
    arco(calidos, cx, base, radio, 0.02);
    seg(calidos, [cx, 0, 0.02], [cx, base, 0.02]);
    // Marco de piedra alrededor del portón
    arco(blancos, cx, base, radio + 0.25);
  };

  const ventanaConReja = (cx: number, y: number, ancho: number, alto: number) => {
    rectangulo(calidos, cx - ancho / 2, y, cx + ancho / 2, y + alto, 0.05);
    for (let i = 1; i < 5; i++) {
      const x = cx - ancho / 2 + (ancho * i) / 5;
      seg(calidos, [x, y, 0.18], [x, y + alto, 0.18]);
    }
    seg(calidos, [cx - ancho / 2 - 0.1, y, 0.2], [cx + ancho / 2 + 0.1, y, 0.2]);
    ventanas.push({ x: cx, y: y + alto / 2, ancho, alto });
  };

  const balcon = (cx: number, y: number, ancho: number) => {
    const sale = 0.7;
    rectangulo(calidos, cx - ancho / 2 + 0.15, y, cx + ancho / 2 - 0.15, y + 1.9, 0.03);
    ventanas.push({ x: cx, y: y + 0.95, ancho: ancho - 0.3, alto: 1.9 });
    const x1 = cx - ancho / 2 - 0.2;
    const x2 = cx + ancho / 2 + 0.2;
    // Piso y baranda del balcón de madera
    seg(calidos, [x1, y, sale], [x2, y, sale]);
    seg(calidos, [x1, y + 1, sale], [x2, y + 1, sale]);
    seg(calidos, [x1, y, 0], [x1, y, sale]);
    seg(calidos, [x2, y, 0], [x2, y, sale]);
    seg(calidos, [x1, y + 1, 0], [x1, y + 1, sale]);
    seg(calidos, [x2, y + 1, 0], [x2, y + 1, sale]);
    for (let x = x1; x <= x2 + 0.01; x += 0.28) seg(calidos, [x, y, sale], [x, y + 1, sale]);
  };

  // Ancho de cada casa, de izquierda a derecha; la del centro es El Recuerdo
  const anchos = [5.2, 4.4, 6, 8.4, 5.6, 4.6, 5.4];
  const centro = 3;
  const total = anchos.reduce((a, b) => a + b, 0);
  let x = -total / 2;
  let destinoPorton = { x: 0, y: 1.6 };

  anchos.forEach((ancho, i) => {
    const x1 = x;
    const x2 = x + ancho;
    const cx = (x1 + x2) / 2;
    const esCentro = i === centro;
    const dosPisos = esCentro || r() > 0.45;
    const alto = dosPisos ? 6.2 + r() * 0.6 : 4.2 + r() * 0.5;
    x = x2;

    // Muros: fachada y aristas hacia el fondo
    rectangulo(blancos, x1, 0, x2, alto);
    seg(blancos, [x1, alto, 0], [x1, alto, -PROFUNDIDAD]);
    seg(blancos, [x2, alto, 0], [x2, alto, -PROFUNDIDAD]);
    seg(blancos, [x1, 0, 0], [x1, 0, -PROFUNDIDAD]);
    // Zócalo
    seg(blancos, [x1, 0.85, 0.01], [x2, 0.85, 0.01]);

    // Tejado a dos aguas con alero y líneas de teja
    const cumbrera = alto + 1.5;
    const aleroZ = 0.7;
    seg(blancos, [x1 - 0.3, alto, aleroZ], [x2 + 0.3, alto, aleroZ]);
    seg(blancos, [x1 - 0.3, cumbrera, -PROFUNDIDAD / 2], [x2 + 0.3, cumbrera, -PROFUNDIDAD / 2]);
    seg(blancos, [x1 - 0.3, alto, aleroZ], [x1 - 0.3, cumbrera, -PROFUNDIDAD / 2]);
    seg(blancos, [x2 + 0.3, alto, aleroZ], [x2 + 0.3, cumbrera, -PROFUNDIDAD / 2]);
    for (let t = x1; t < x2 + 0.3; t += 0.45)
      seg(blancos, [t, alto + 0.02, aleroZ], [t, cumbrera, -PROFUNDIDAD / 2]);

    // Portón
    const anchoPorton = esCentro ? 2.6 : 1.7;
    const xPorton = esCentro ? cx : r() > 0.5 ? x1 + 1.4 : x2 - 1.4;
    porton(xPorton, anchoPorton, esCentro ? 3.4 : 2.7);
    if (esCentro) destinoPorton = { x: xPorton, y: 1.6 };

    // Ventanas con reja en el primer piso
    for (let v = x1 + 1.1; v < x2 - 0.8; v += 1.9) {
      if (Math.abs(v - xPorton) < anchoPorton / 2 + 0.9) continue;
      ventanaConReja(v, 1.3, 1, 1.5);
    }
    // Balcones en el segundo piso
    if (dosPisos) {
      const n = Math.max(1, Math.floor(ancho / 2.6));
      for (let b = 0; b < n; b++) balcon(x1 + (ancho * (b + 0.5)) / n, 3.5, 1.3);
    }
  });

  return { blancos, calidos, ventanas, porton: destinoPorton };
}

// Ordena los segmentos de abajo hacia arriba y del centro hacia los lados: la calle se
// "construye" desde el suelo cuando se anima el rango de dibujo
export function ordenarParaTrazo(segmentos: number[]): Float32Array {
  const n = segmentos.length / 6;
  const indices = Array.from({ length: n }, (_, i) => i);
  const clave = (i: number) => {
    const o = i * 6;
    const y = Math.min(segmentos[o + 1]!, segmentos[o + 4]!);
    const x = Math.abs(segmentos[o]! + segmentos[o + 3]!) / 2;
    return y + x * 0.12;
  };
  indices.sort((a, b) => clave(a) - clave(b));
  const salida = new Float32Array(segmentos.length);
  indices.forEach((origen, destino) => {
    for (let k = 0; k < 6; k++) salida[destino * 6 + k] = segmentos[origen * 6 + k]!;
  });
  return salida;
}
