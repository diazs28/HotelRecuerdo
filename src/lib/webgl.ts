// true si el navegador puede dibujar 3D (WebGL). Archivo aparte para no cargar three.js al consultarlo.
export const webglDisponible = (): boolean => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
};
