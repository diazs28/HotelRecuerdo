// Adaptado de Karbon/commitlint.config.js. Ajusta scope-enum a las áreas del proyecto.
// Dependencias: npm i -D @commitlint/cli @commitlint/config-conventional husky lint-staged
/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['frontend', 'backend', 'db', 'reservas', 'habitaciones', 'publico', 'panel', 'docker', 'docs', 'ci', 'deps', 'repo'],
    ],
    // Los asuntos van en español y pueden empezar con mayúscula o nombre propio.
    'subject-case': [0],
  },
};
