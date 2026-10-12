import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearHabitacion,
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
let token: string;

before(async () => {
  srv = await iniciarServidor();
});
after(async () => {
  await srv.cerrar();
});
beforeEach(async () => {
  await prepararBd();
  token = (await sesion(srv.url, 'administrador')).token;
});

const estado = (id: string, e: string) =>
  peticion(srv.url, 'POST', `/admin/reservas/${id}/estado`, { token, body: { estado: e } });

async function ocupacionesActivas(reservaId: string) {
  return prisma.ocupacion.findMany({ where: { reservaId, activa: true } });
}

describe('casos límite y concurrencia (revisión)', () => {
  it('editar notas a la vez que otra persona cambia las fechas no revierte las fechas', async () => {
    const h = await crearHabitacion(1);
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(12),
      camaIds: [h.camas[0]!.id],
    });
    await Promise.all([
      peticion(srv.url, 'PATCH', `/admin/reservas/${r.body.id}`, {
        token,
        body: { fechaSalida: dia(15) },
      }),
      peticion(srv.url, 'PATCH', `/admin/reservas/${r.body.id}`, {
        token,
        body: { notasOperativas: 'Llega tarde' },
      }),
    ]);
    const final = await peticion(srv.url, 'GET', `/admin/reservas/${r.body.id}`, { token });
    assert.equal(final.body.fechaSalida, dia(15));
    assert.equal(final.body.notasOperativas, 'Llega tarde');
    assert.equal(final.body.camas[0].hasta, dia(15));
  });

  it('salida el mismo día de la entrada: las camas quedan libres', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(0),
      salida: dia(3),
      camaIds: [cama],
    });
    await estado(r.body.id, 'CONFIRMADA');
    await estado(r.body.id, 'EN_ALOJAMIENTO');
    const fin = await estado(r.body.id, 'FINALIZADA');
    assert.equal(fin.status, 200);
    assert.equal((await ocupacionesActivas(r.body.id)).length, 0);
    const otra = await crearReservaApi(srv.url, token, {
      entrada: dia(0),
      salida: dia(2),
      camaIds: [cama],
    });
    assert.equal(otra.status, 201);
  });

  it('liberar el mismo día un bloqueo de habitación que recibió una cama nueva no falla', async () => {
    const h = await crearHabitacion(1);
    const b = await peticion(srv.url, 'POST', '/admin/bloqueos', {
      token,
      body: { tipo: 'BLOQUEO', habitacionId: h.id, fechaInicio: dia(-2), motivo: 'Pintura' },
    });
    await peticion(srv.url, 'POST', `/admin/habitaciones/${h.id}/camas`, {
      token,
      body: { identificador: 'B', tipo: 'SENCILLA' },
    });
    const liberado = await peticion(srv.url, 'POST', `/admin/bloqueos/${b.body.id}/liberar`, {
      token,
    });
    assert.equal(liberado.status, 200);
    const activas = await prisma.ocupacion.findMany({
      where: { bloqueoId: b.body.id, activa: true },
    });
    // La cama original conserva sus noches pasadas; la nueva no tenía noches y queda anulada
    assert.equal(activas.length, 1);
  });

  it('quitar una cama a mitad de la estancia conserva las noches usadas y libera las futuras', async () => {
    const h = await crearHabitacion(2);
    const [a, b] = h.camas.map((c) => c.id) as [string, string];
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(-2),
      salida: dia(3),
      camaIds: [a, b],
    });
    await estado(r.body.id, 'CONFIRMADA');
    await estado(r.body.id, 'EN_ALOJAMIENTO');
    const sinB = await peticion(srv.url, 'DELETE', `/admin/reservas/${r.body.id}/camas/${b}`, {
      token,
    });
    assert.equal(sinB.status, 200);
    assert.equal(sinB.body.camas.length, 1);
    const ocupB = await prisma.ocupacion.findFirstOrThrow({
      where: { reservaId: r.body.id, camaId: b },
    });
    assert.equal(ocupB.activa, true);
    assert.equal(ocupB.fechaFin?.toISOString().slice(0, 10), dia(0));
    // La cama B queda disponible desde hoy para otra reserva
    const otra = await crearReservaApi(srv.url, token, {
      entrada: dia(0),
      salida: dia(2),
      camaIds: [b],
    });
    assert.equal(otra.status, 201);
    // Extender la estancia no vuelve a tomar la cama que se quitó
    const ext = await peticion(srv.url, 'PATCH', `/admin/reservas/${r.body.id}`, {
      token,
      body: { fechaSalida: dia(4) },
    });
    assert.equal(ext.status, 200);
    assert.equal(ext.body.camas.length, 1);
  });

  it('anonimizar mientras otra persona edita al huésped no devuelve sus datos', async () => {
    const r = await crearReservaApi(srv.url, token, { entrada: dia(1), salida: dia(2) });
    await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/estado`, {
      token,
      body: { estado: 'CANCELADA', motivo: 'Prueba' },
    });
    const huespedId = (await prisma.reserva.findUniqueOrThrow({ where: { id: r.body.id } }))
      .huespedId;
    await Promise.all([
      peticion(srv.url, 'POST', `/admin/huespedes/${huespedId}/anonimizar`, { token }),
      peticion(srv.url, 'PATCH', `/admin/huespedes/${huespedId}`, {
        token,
        body: { telefono: '3009998877' },
      }),
    ]);
    const h = await prisma.huesped.findUniqueOrThrow({ where: { id: huespedId } });
    assert.ok(h.anonimizadoEn);
    assert.equal(h.telefono, null);
    const reserva = await prisma.reserva.findUniqueOrThrow({ where: { id: r.body.id } });
    assert.equal(reserva.huellaSolicitud, null);
  });

  it('dos administradores que se desactivan mutuamente a la vez: queda al menos uno', async () => {
    const otro = await crearUsuario('administrador');
    const tokenOtro = await login(srv.url, otro.email);
    const yo = await prisma.usuario.findFirstOrThrow({
      where: { rol: { codigo: 'administrador' }, NOT: { id: otro.id } },
    });
    const [a, b] = await Promise.all([
      peticion(srv.url, 'PATCH', `/admin/usuarios/${otro.id}`, { token, body: { activo: false } }),
      peticion(srv.url, 'PATCH', `/admin/usuarios/${yo.id}`, {
        token: tokenOtro,
        body: { activo: false },
      }),
    ]);
    assert.ok([a.status, b.status].includes(409) || [a.status, b.status].includes(401));
    const activos = await prisma.usuario.count({
      where: { activo: true, rol: { codigo: 'administrador' } },
    });
    assert.ok(activos >= 1);
  });

  it('una transición inválida devuelve detalles en el formato común', async () => {
    const r = await crearReservaApi(srv.url, token, { entrada: dia(1), salida: dia(2) });
    const x = await estado(r.body.id, 'FINALIZADA');
    assert.equal(x.status, 409);
    assert.ok(Array.isArray(x.body.error.details));
    assert.equal(x.body.error.details[0].path, 'estado');
  });
});
