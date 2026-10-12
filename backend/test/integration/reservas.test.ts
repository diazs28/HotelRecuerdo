import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canalId,
  crearHabitacion,
  crearReservaApi,
  dia,
  huespedNuevo,
  iniciarServidor,
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
  token = (await sesion(srv.url, 'recepcion')).token;
});

const estado = (id: string, e: string, motivo?: string) =>
  peticion(srv.url, 'POST', `/admin/reservas/${id}/estado`, {
    token,
    body: { estado: e, ...(motivo ? { motivo } : {}) },
  });

describe('crear y consultar reservas', () => {
  it('crea una reserva con camas, código legible y auditoría', async () => {
    const h = await crearHabitacion(2);
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(13),
      cantidad: 2,
      camaIds: h.camas.map((c) => c.id),
    });
    assert.equal(r.status, 201);
    assert.match(r.body.codigo, /^HR-\d{5}$/);
    assert.equal(r.body.estado, 'PENDIENTE_CONFIRMACION');
    assert.equal(r.body.noches, 3);
    assert.equal(r.body.plazasAsignadas, 2);
    assert.equal(r.body.camas.length, 2);

    const detalle = await peticion(srv.url, 'GET', `/admin/reservas/${r.body.id}`, { token });
    assert.equal(detalle.status, 200);
    assert.equal(detalle.body.historial[0].accion, 'reserva.creada');
    assert.equal(detalle.body.historial[0].usuario.nombre, 'Recepción Prueba');
    // La auditoría no guarda datos personales del huésped
    assert.ok(!JSON.stringify(detalle.body.historial).includes('3001234567'));
  });

  it('rechaza salida igual o anterior a la entrada', async () => {
    const r = await crearReservaApi(srv.url, token, { entrada: dia(5), salida: dia(5) });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
    assert.ok(r.body.error.details.some((d: { path: string }) => d.path === 'fechaSalida'));
  });

  it('busca por código, nombre y teléfono, y filtra por fechas', async () => {
    const a = await crearReservaApi(srv.url, token, { entrada: dia(10), salida: dia(12) });
    await crearReservaApi(srv.url, token, { entrada: dia(40), salida: dia(42) });

    const porCodigo = await peticion(srv.url, 'GET', `/admin/reservas?q=${a.body.codigo}`, {
      token,
    });
    assert.equal(porCodigo.body.total, 1);
    const porNombre = await peticion(
      srv.url,
      'GET',
      `/admin/reservas?q=${encodeURIComponent(a.body.huesped.nombres)}`,
      { token },
    );
    assert.equal(porNombre.body.total, 1);
    const porTelefono = await peticion(srv.url, 'GET', '/admin/reservas?q=300%20123', { token });
    assert.equal(porTelefono.body.total, 2);
    const porFechas = await peticion(
      srv.url,
      'GET',
      `/admin/reservas?desde=${dia(11)}&hasta=${dia(20)}`,
      { token },
    );
    assert.equal(porFechas.body.total, 1);
    assert.equal(porFechas.body.reservas[0].id, a.body.id);
  });

  it('con Idempotency-Key, repetir la creación no duplica la reserva', async () => {
    const body = {
      huesped: huespedNuevo('idem'),
      canalId: await canalId(),
      fechaEntrada: dia(3),
      fechaSalida: dia(4),
      cantidadHuespedes: 1,
    };
    const headers = { 'Idempotency-Key': 'clave-idempotencia-0001' };
    const r1 = await peticion(srv.url, 'POST', '/admin/reservas', { token, body, headers });
    const r2 = await peticion(srv.url, 'POST', '/admin/reservas', { token, body, headers });
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 200);
    assert.equal(r2.body.id, r1.body.id);
    assert.equal(await prisma.reserva.count(), 1);

    const distinto = await peticion(srv.url, 'POST', '/admin/reservas', {
      token,
      body: { ...body, cantidadHuespedes: 2 },
      headers,
    });
    assert.equal(distinto.status, 422);
    assert.equal(distinto.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
  });
});

describe('asignación de camas sin solapamientos', () => {
  it('impide asignar una cama ya ocupada en noches que se cruzan', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const a = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(13),
      camaIds: [cama],
    });
    assert.equal(a.status, 201);

    const b = await crearReservaApi(srv.url, token, {
      entrada: dia(12),
      salida: dia(14),
      camaIds: [cama],
    });
    assert.equal(b.status, 409);
    assert.equal(b.body.error.code, 'CAMA_NO_DISPONIBLE');
    assert.match(b.body.error.details[0].message, new RegExp(a.body.codigo));
    // La transacción fallida no dejó ni la reserva ni el huésped
    assert.equal(await prisma.reserva.count(), 1);
    assert.equal(await prisma.huesped.count(), 1);
  });

  it('permite que la salida de una reserva sea la entrada de otra', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const a = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(13),
      camaIds: [cama],
    });
    const b = await crearReservaApi(srv.url, token, {
      entrada: dia(13),
      salida: dia(15),
      camaIds: [cama],
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
  });

  it('asigna una habitación completa y quita camas', async () => {
    const h = await crearHabitacion(3);
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(12),
      cantidad: 2,
    });
    const asignada = await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/camas`, {
      token,
      body: { habitacionIds: [h.id] },
    });
    assert.equal(asignada.status, 200);
    assert.equal(asignada.body.camas.length, 3);

    const quitada = await peticion(
      srv.url,
      'DELETE',
      `/admin/reservas/${r.body.id}/camas/${h.camas[2]!.id}`,
      { token },
    );
    assert.equal(quitada.status, 200);
    assert.equal(quitada.body.camas.length, 2);
  });

  it('cambiar las fechas mueve las camas y respeta los cruces', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const a = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(12),
      camaIds: [cama],
    });
    await crearReservaApi(srv.url, token, { entrada: dia(14), salida: dia(16), camaIds: [cama] });

    const ok = await peticion(srv.url, 'PATCH', `/admin/reservas/${a.body.id}`, {
      token,
      body: { fechaSalida: dia(14) },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.camas[0].hasta, dia(14));

    const choque = await peticion(srv.url, 'PATCH', `/admin/reservas/${a.body.id}`, {
      token,
      body: { fechaSalida: dia(15) },
    });
    assert.equal(choque.status, 409);
    assert.equal(choque.body.error.code, 'CAMA_NO_DISPONIBLE');
    // Nada cambió
    const actual = await peticion(srv.url, 'GET', `/admin/reservas/${a.body.id}`, { token });
    assert.equal(actual.body.fechaSalida, dia(14));
  });
});

describe('cambios de estado', () => {
  it('convierte una solicitud en reserva confirmada solo con camas suficientes', async () => {
    const h = await crearHabitacion(2);
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(5),
      salida: dia(7),
      cantidad: 2,
      estadoInicial: 'SOLICITUD',
    });
    const sinCamas = await estado(r.body.id, 'CONFIRMADA');
    assert.equal(sinCamas.status, 409);
    assert.equal(sinCamas.body.error.code, 'CAPACIDAD_INSUFICIENTE');

    await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/camas`, {
      token,
      body: { camaIds: [h.camas[0]!.id] },
    });
    assert.equal((await estado(r.body.id, 'CONFIRMADA')).status, 409);

    await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/camas`, {
      token,
      body: { camaIds: [h.camas[1]!.id] },
    });
    const confirmada = await estado(r.body.id, 'CONFIRMADA');
    assert.equal(confirmada.status, 200);
    assert.equal(confirmada.body.estado, 'CONFIRMADA');
    assert.ok(confirmada.body.confirmadaEn);

    // Una reserva confirmada no puede quedarse sin plazas
    const quitar = await peticion(
      srv.url,
      'DELETE',
      `/admin/reservas/${r.body.id}/camas/${h.camas[0]!.id}`,
      { token },
    );
    assert.equal(quitar.status, 409);
  });

  it('rechaza transiciones inválidas y repetidas con error controlado', async () => {
    const r = await crearReservaApi(srv.url, token, { entrada: dia(5), salida: dia(7) });
    const salto = await estado(r.body.id, 'FINALIZADA');
    assert.equal(salto.status, 409);
    assert.equal(salto.body.error.code, 'TRANSICION_INVALIDA');
    const repetido = await estado(r.body.id, 'PENDIENTE_CONFIRMACION');
    assert.equal(repetido.status, 409);
    assert.equal(repetido.body.error.code, 'ESTADO_REPETIDO');
  });

  it('cancelar exige motivo, libera las camas y es un estado final', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const a = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(12),
      camaIds: [cama],
    });

    assert.equal((await estado(a.body.id, 'CANCELADA')).status, 400);
    const cancelada = await estado(a.body.id, 'CANCELADA', 'El huésped desistió');
    assert.equal(cancelada.status, 200);
    assert.equal(cancelada.body.camas.length, 0);

    // La cama queda libre para otra reserva en las mismas fechas
    const b = await crearReservaApi(srv.url, token, {
      entrada: dia(10),
      salida: dia(12),
      camaIds: [cama],
    });
    assert.equal(b.status, 201);

    assert.equal((await estado(a.body.id, 'CONFIRMADA')).status, 409);
    const asignar = await peticion(srv.url, 'POST', `/admin/reservas/${a.body.id}/camas`, {
      token,
      body: { camaIds: [cama] },
    });
    assert.equal(asignar.status, 409);
  });

  it('registra el ingreso solo dentro de las fechas y finaliza con salida anticipada', async () => {
    const h = await crearHabitacion(1);
    const futura = await crearReservaApi(srv.url, token, {
      entrada: dia(3),
      salida: dia(5),
      camaIds: [h.camas[0]!.id],
    });
    await estado(futura.body.id, 'CONFIRMADA');
    const temprano = await estado(futura.body.id, 'EN_ALOJAMIENTO');
    assert.equal(temprano.status, 409);
    assert.equal(temprano.body.error.code, 'FECHA_NO_PERMITE_INGRESO');

    const h2 = await crearHabitacion(1);
    const actual = await crearReservaApi(srv.url, token, {
      entrada: dia(-2),
      salida: dia(3),
      camaIds: [h2.camas[0]!.id],
    });
    await estado(actual.body.id, 'CONFIRMADA');
    assert.equal((await estado(actual.body.id, 'EN_ALOJAMIENTO')).status, 200);
    const fin = await estado(actual.body.id, 'FINALIZADA');
    assert.equal(fin.status, 200);
    assert.equal(fin.body.fechaSalida, dia(0));
    assert.equal(fin.body.camas[0].hasta, dia(0));

    const historial = await prisma.auditoria.findMany({
      where: { entidadId: actual.body.id, accion: 'reserva.estado' },
      orderBy: { createdAt: 'asc' },
    });
    assert.deepEqual(
      historial.map((h) => (h.datos as { a: string }).a),
      ['CONFIRMADA', 'EN_ALOJAMIENTO', 'FINALIZADA'],
    );
  });

  it('la auditoría es inmutable en la base de datos', async () => {
    const r = await crearReservaApi(srv.url, token, { entrada: dia(5), salida: dia(6) });
    await assert.rejects(
      prisma.auditoria.updateMany({ where: { entidadId: r.body.id }, data: { accion: 'x' } }),
    );
    await assert.rejects(prisma.auditoria.deleteMany({ where: { entidadId: r.body.id } }));
  });
});
