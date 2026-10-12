import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { erroresDeEnv } from '../../src/config/env.js';

const base = {
  DATABASE_URL: 'postgresql://app:clave@localhost:5432/hotel',
  JWT_SECRET: 'x'.repeat(40),
};

describe('validación del entorno al arrancar', () => {
  it('acepta la configuración mínima de desarrollo', () => {
    assert.deepEqual(erroresDeEnv({ ...base, NODE_ENV: 'development' }), []);
  });

  it('exige DATABASE_URL y un JWT_SECRET de al menos 32 caracteres', () => {
    const errores = erroresDeEnv({ NODE_ENV: 'development', JWT_SECRET: 'corto' });
    assert.ok(errores.some((e) => e.startsWith('DATABASE_URL')));
    assert.ok(errores.some((e) => e.startsWith('JWT_SECRET')));
  });

  it('en producción exige TRUST_PROXY y rechaza una base de pruebas', () => {
    const errores = erroresDeEnv({
      ...base,
      NODE_ENV: 'production',
      TEST_DATABASE_URL: 'postgresql://a:b@localhost/hotel_test',
    });
    assert.ok(errores.some((e) => e.startsWith('TRUST_PROXY')));
    assert.ok(errores.some((e) => e.startsWith('TEST_DATABASE_URL')));
  });

  it('los mensajes nunca incluyen el valor de la variable', () => {
    const secreto = 'secreto-muy-corto';
    const errores = erroresDeEnv({ ...base, JWT_SECRET: secreto });
    assert.ok(errores.length > 0);
    assert.ok(errores.every((e) => !e.includes(secreto)));
  });
});
