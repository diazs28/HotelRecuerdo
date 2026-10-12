import { randomBytes } from 'node:crypto';
import { argon2id, hash, needsRehash, verify } from 'argon2';

// Argon2id con los parámetros mínimos recomendados por OWASP
// (Password Storage Cheat Sheet): m = 19 MiB, t = 2, p = 1.
const ARGON2_OPCIONES = {
  type: argon2id,
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPCIONES);
}

// argon2.verify compara en tiempo constante. Un hash malformado se trata como no coincidente.
export async function verifyPassword(hashGuardado: string, password: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, password);
  } catch {
    return false;
  }
}

// true si el hash se creó con parámetros distintos a los actuales (conviene re-hashear al iniciar sesión)
export function necesitaRehash(hashGuardado: string): boolean {
  try {
    return needsRehash(hashGuardado, ARGON2_OPCIONES);
  } catch {
    return false;
  }
}

// Hash de relleno para que "email inexistente" tarde lo mismo que "contraseña incorrecta"
let hashDeRelleno: Promise<string> | undefined;

// Verifica una credencial. Si no hay usuario (hash null) igual se ejecuta Argon2
// contra un hash de relleno y se devuelve false, para no revelar por tiempo si el email existe.
export async function verificarCredencial(
  hashGuardado: string | null,
  password: string,
): Promise<boolean> {
  if (hashGuardado === null) {
    hashDeRelleno ??= hashPassword(randomBytes(32).toString('base64url'));
    await verifyPassword(await hashDeRelleno, password);
    return false;
  }
  return verifyPassword(hashGuardado, password);
}
