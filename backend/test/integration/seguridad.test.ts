import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD,
  crearReservaApi,
  crearUsuario,
  dia,
  iniciarServidor,
  login,
  peticion,
  prepararBd,
  prisma,
  sesion,
  type Servidor,
} from '../helpers.js';

let srv: Servidor;

before(async () => {
  srv = await iniciarServidor();
});
after(async () => {
  await srv.cerrar();
});
beforeEach(async () => {
  await prepararBd();
});

describe('autenticación del personal', () => {
  it('inicia sesión, consulta su perfil y cierra sesión invalidando el token', async () => {
    const u = await crearUsuario('recepcion');
    const r = await peticion(srv.url, 'POST', '/auth/login', {
      body: { email: u.email, password: PASSWORD },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.tokenType, 'Bearer');
    assert.ok(r.body.usuario.permisos.includes('reservas:gestionar'));
    assert.ok(!('passwordHash' in r.body.usuario));

    const me = await peticion(srv.url, 'GET', '/auth/me', { token: r.body.token });
    assert.equal(me.status, 200);
    await peticion(srv.url, 'POST', '/auth/logout', { token: r.body.token });
    const despues = await peticion(srv.url, 'GET', '/auth/me', { token: r.body.token });
    assert.equal(despues.status, 401);
  });

  it('responde igual si el correo no existe o la contraseña es incorrecta', async () => {
    const u = await crearUsuario('recepcion');
    const mala = await peticion(srv.url, 'POST', '/auth/login', {
      body: { email: u.email, password: 'otra-clave-incorrecta' },
    });
    const inexistente = await peticion(srv.url, 'POST', '/auth/login', {
      body: { email: 'nadie@hotel.test', password: 'otra-clave-incorrecta' },
    });
    assert.equal(mala.status, 401);
    assert.deepEqual(mala.body, inexistente.body);
  });

  it('bloquea por exceso de intentos fallidos', async () => {
    const u = await crearUsuario('recepcion');
    let ultimo = 0;
    for (let i = 0; i < 6; i++) {
      ultimo = (
        await peticion(srv.url, 'POST', '/auth/login', {
          body: { email: u.email, password: 'incorrecta-123' },
        })
      ).status;
    }
    assert.equal(ultimo, 429);
  });

  it('una cuenta desactivada pierde el acceso de inmediato', async () => {
    const { token: tokenAdmin } = await sesion(srv.url, 'administrador');
    const u = await crearUsuario('recepcion');
    const token = await login(srv.url, u.email);
    await peticion(srv.url, 'PATCH', `/admin/usuarios/${u.id}`, {
      token: tokenAdmin,
      body: { activo: false },
    });
    assert.equal((await peticion(srv.url, 'GET', '/auth/me', { token })).status, 401);
  });

  it('rechaza peticiones sin token o con token manipulado', async () => {
    assert.equal((await peticion(srv.url, 'GET', '/admin/reservas')).status, 401);
    const { token } = await sesion(srv.url, 'recepcion');
    const [cab, cuerpo] = token.split('.');
    const falso = `${cab}.${cuerpo}.firmafalsa`;
    assert.equal((await peticion(srv.url, 'GET', '/admin/reservas', { token: falso })).status, 401);
  });
});

describe('autorización por rol en el servidor', () => {
  it('recepción no accede a configuración, usuarios, auditoría ni derechos de datos', async () => {
    const { token } = await sesion(srv.url, 'recepcion');
    const r = await crearReservaApi(srv.url, token, { entrada: dia(1), salida: dia(2) });
    const huespedId = (await prisma.reserva.findUniqueOrThrow({ where: { id: r.body.id } }))
      .huespedId;
    for (const [metodo, ruta] of [
      ['GET', '/admin/configuracion/ajustes'],
      ['GET', '/admin/usuarios'],
      ['GET', '/admin/roles'],
      ['GET', '/admin/auditoria'],
      ['GET', `/admin/huespedes/${huespedId}/exportar`],
      ['POST', `/admin/huespedes/${huespedId}/anonimizar`],
    ] as const) {
      const res = await peticion(srv.url, metodo, ruta, { token });
      assert.equal(res.status, 403, `${metodo} ${ruta}`);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }
  });

  it('el documento del huésped se enmascara para recepción y se ve completo para administración', async () => {
    const { token: tRecepcion } = await sesion(srv.url, 'recepcion');
    const { token: tAdmin } = await sesion(srv.url, 'administrador');
    const r = await peticion(srv.url, 'POST', '/admin/reservas', {
      token: tRecepcion,
      body: {
        huesped: {
          nombres: 'Carlos',
          apellidos: 'Ruiz',
          telefono: '3201112233',
          tipoDocumento: 'CC',
          numeroDocumento: '10612345',
        },
        canalId: (await prisma.canal.findUniqueOrThrow({ where: { codigo: 'presencial' } })).id,
        fechaEntrada: dia(1),
        fechaSalida: dia(2),
        cantidadHuespedes: 1,
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.huesped.numeroDocumento, '••••2345');
    const comoAdmin = await peticion(srv.url, 'GET', `/admin/reservas/${r.body.id}`, {
      token: tAdmin,
    });
    assert.equal(comoAdmin.body.huesped.numeroDocumento, '10612345');
  });

  it('los permisos de un rol se cambian desde el panel y aplican de inmediato', async () => {
    const { token: tAdmin } = await sesion(srv.url, 'administrador');
    const { token: tRecepcion } = await sesion(srv.url, 'recepcion');
    const roles = await peticion(srv.url, 'GET', '/admin/roles', { token: tAdmin });
    const rol = roles.body.roles.find((x: { codigo: string }) => x.codigo === 'recepcion');
    const sinCancelar = rol.permisos.filter((p: string) => p !== 'reservas:cancelar');
    const put = await peticion(srv.url, 'PUT', `/admin/roles/${rol.id}/permisos`, {
      token: tAdmin,
      body: { permisos: sinCancelar },
    });
    assert.equal(put.status, 200);

    const r = await crearReservaApi(srv.url, tRecepcion, { entrada: dia(1), salida: dia(2) });
    const cancelar = await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/estado`, {
      token: tRecepcion,
      body: { estado: 'CANCELADA', motivo: 'Prueba' },
    });
    assert.equal(cancelar.status, 403);
  });

  it('el rol administrador no puede perder la gestión de usuarios', async () => {
    const { token } = await sesion(srv.url, 'administrador');
    const rol = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'administrador' } });
    const r = await peticion(srv.url, 'PUT', `/admin/roles/${rol.id}/permisos`, {
      token,
      body: { permisos: ['tablero:ver'] },
    });
    assert.equal(r.status, 409);
  });
});

describe('derechos del titular (Ley 1581)', () => {
  it('exporta y anonimiza los datos de un huésped sin reservas vigentes', async () => {
    const { token } = await sesion(srv.url, 'administrador');
    const r = await crearReservaApi(srv.url, token, { entrada: dia(1), salida: dia(2) });
    const huespedId = (await prisma.reserva.findUniqueOrThrow({ where: { id: r.body.id } }))
      .huespedId;

    const exp = await peticion(srv.url, 'GET', `/admin/huespedes/${huespedId}/exportar`, { token });
    assert.equal(exp.status, 200);
    assert.equal(exp.body.reservas.length, 1);

    const vigente = await peticion(srv.url, 'POST', `/admin/huespedes/${huespedId}/anonimizar`, {
      token,
    });
    assert.equal(vigente.status, 409);

    await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/estado`, {
      token,
      body: { estado: 'CANCELADA', motivo: 'Solicitud del titular' },
    });
    const ok = await peticion(srv.url, 'POST', `/admin/huespedes/${huespedId}/anonimizar`, {
      token,
    });
    assert.equal(ok.status, 204);
    const h = await prisma.huesped.findUniqueOrThrow({ where: { id: huespedId } });
    assert.equal(h.telefono, null);
    assert.equal(h.email, null);
    assert.ok(h.anonimizadoEn);
    // La reserva conserva su historial operativo
    assert.equal(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: r.body.id } })).estado,
      'CANCELADA',
    );
  });
});

describe('errores y cabeceras', () => {
  it('no expone detalles internos y aplica cabeceras de seguridad', async () => {
    const res = await fetch(`${srv.url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{mal json',
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: { code: 'INVALID_JSON', message: 'JSON mal formado' },
    });
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    // Las respuestas privadas (incluidos los 401) no se guardan en caché
    const privada = await fetch(`${srv.url}/admin/reservas`);
    assert.equal(privada.status, 401);
    assert.equal(privada.headers.get('cache-control'), 'no-store');
  });

  it('documenta la API en OpenAPI', async () => {
    const r = await peticion(srv.url, 'GET', '/docs/openapi.json');
    assert.equal(r.status, 200);
    assert.equal(r.body.openapi, '3.1.0');
    assert.ok(r.body.paths['/admin/reservas/{id}/estado'].post);
  });
});
