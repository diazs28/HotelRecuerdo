# Hotel El Recuerdo — demostración

## Descripción

Copia del **sitio público y del panel del personal** de Hotel El Recuerdo en *modo demostración*,
para mostrarla a clientes. Funciona sin API ni base de datos: una API simulada en el navegador
responde con datos de ejemplo (20 habitaciones, 37 camas, huéspedes ficticios y reservas alrededor
de hoy) y aplica las mismas reglas del sistema real. Los cambios se guardan solo en la pestaña de
quien la visita y nada se envía al hotel. En `/panel` se entra con un clic como Administración o
como Recepción (contraseña de ejemplo: `demo`). La página lleva la cabecera `noindex` para
que los buscadores no la confundan con el sitio oficial.

El código fuente vive en el proyecto `hotel-el-recuerdo/frontend`. Esta carpeta se genera con
su script `scripts/exportar-demo.mjs`; **no edites aquí**: cambia el proyecto y vuelve a exportar.

## Stack

React 19, Vite 7, TypeScript, Tailwind CSS 4, three.js (maquetas 3D), GSAP y Lenis.

## Requisitos

Node.js 22 o superior y npm.

## Instalación

```bash
npm ci
npm run dev        # http://localhost:5180
```

## Variables de entorno

Ninguna. El modo demostración queda fijo en `vite.config.ts`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor local |
| `npm run build` | Compila a `dist/` |
| `npm run check` | Lint, tipos y build |

## Estructura

Igual que `hotel-el-recuerdo/frontend` (`src/`, `public/`), más `vercel.json`.

## Despliegue en Vercel

Opción A, desde la terminal:

```bash
npx vercel          # primera vez: crea el proyecto (vista previa)
npx vercel --prod   # publica en la URL de producción
```

Opción B, con GitHub: sube esta carpeta a un repositorio y en vercel.com elige
*Add New → Project → Import*. Vercel detecta Vite y usa `vercel.json`.

## Actualizar la demo

Desde `hotel-el-recuerdo/frontend`:

```bash
node scripts/exportar-demo.mjs
```

## Seguridad

Sin secretos ni variables de entorno. No recibe datos personales: el formulario no envía nada.
