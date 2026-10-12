// Exposición de datos personales según los permisos de quien consulta. Funciones puras.

export interface PermisosDatos {
  verContacto: boolean;
  verDocumento: boolean;
}

// "3001234567" -> "••••••••67"
export function enmascarar(valor: string | null, visibles = 2): string | null {
  if (valor === null) return null;
  const limpio = valor.trim();
  if (limpio.length <= visibles) return '•'.repeat(limpio.length);
  return '•'.repeat(Math.min(limpio.length - visibles, 8)) + limpio.slice(-visibles);
}

// "ana.perez@correo.com" -> "a•••@correo.com"
export function enmascararEmail(valor: string | null): string | null {
  if (valor === null) return null;
  const [usuario = '', dominio = ''] = valor.split('@');
  return `${usuario.slice(0, 1)}•••@${dominio}`;
}

export interface HuespedBd {
  id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  anonimizadoEn: Date | null;
}

export function presentarHuesped(h: HuespedBd, permisos: PermisosDatos) {
  return {
    id: h.id,
    nombres: h.nombres,
    apellidos: h.apellidos,
    telefono: permisos.verContacto ? h.telefono : enmascarar(h.telefono),
    email: permisos.verContacto ? h.email : enmascararEmail(h.email),
    tipoDocumento: h.tipoDocumento,
    numeroDocumento: permisos.verDocumento ? h.numeroDocumento : enmascarar(h.numeroDocumento, 4),
    datosRestringidos: !permisos.verContacto || !permisos.verDocumento,
    anonimizado: h.anonimizadoEn !== null,
  };
}
