import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  crearHabitacion,
  crearReservaApi,
  dia,
  iniciarServidor,
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

function solicitud(extra: Record<string, unknown> = {}) {
  return {
    fechaEntrada: dia(10),
    fechaSalida: dia(12),
    cantidadHuespedes: 2,
    nombres: 'María',
    apellidos: 'López',
    telefono: '3157778899',
    email: 'maria@correo.test',
    comentario: 'Llegamos en la noche',
    aceptaTratamientoDatos: true,
    ...extra,
  };
}

const enviar = (body: unknown, clave: string | null = randomUUID()) =>
  peticion(srv.url, 'POST', '/publico/solicitudes', {
    body,
    headers: clave ? { 'Idempotency-Key': clave } : {},
  });

describe('formulario público de solicitud', () => {
  it('crea una SOLICITUD sin camas, con consentimiento, que no es una reserva confirmada', async () => {
    const r = await enviar(solicitud());
    assert.equal(r.status, 201);
    assert.equal(r.body.estado, 'SOLICITUD');
    assert.match(r.body.mensaje, /no es una reserva confirmada/i);

    const reserva = await prisma.reserva.findFirstOrThrow({
      include: { huesped: true, canal: true, ocupaciones: true },
    });
    assert.equal(reserva.estado, 'SOLICITUD');
    assert.equal(reserva.canal.codigo, 'web');
    assert.equal(reserva.ocupaciones.length, 0);
    assert.ok(reserva.huesped.consentimientoEn);
    assert.equal(reserva.creadoPorId, null);
  });

  it('el personal la ve como pendiente y la convierte en reserva confirmada', async () => {
    const enviada = await enviar(solicitud({ cantidadHuespedes: 1 }));
    const { token } = await sesion(srv.url, 'recepcion');
    const tablero = await peticion(srv.url, 'GET', '/admin/tablero', { token });
    assert.equal(tablero.body.pendientes.total, 1);

    const id = tablero.body.pendientes.primeras[0].id;
    const h = await crearHabitacion(1);
    await peticion(srv.url, 'POST', `/admin/reservas/${id}/camas`, {
      token,
      body: { camaIds: [h.camas[0]!.id] },
    });
    const confirmada = await peticion(srv.url, 'POST', `/admin/reservas/${id}/estado`, {
      token,
      body: { estado: 'CONFIRMADA' },
    });
    assert.equal(confirmada.status, 200);
    assert.equal(confirmada.body.codigo, enviada.body.codigo);
  });

  it('exige autorización de datos, clave de idempotencia y fechas válidas', async () => {
    assert.equal((await enviar(solicitud({ aceptaTratamientoDatos: false }))).status, 400);
    assert.equal((await enviar(solicitud(), null)).status, 400);
    const pasada = await enviar(solicitud({ fechaEntrada: dia(-1), fechaSalida: dia(1) }));
    assert.equal(pasada.status, 400);
    assert.equal(pasada.body.error.code, 'FECHA_PASADA');
    const invertida = await enviar(solicitud({ fechaEntrada: dia(5), fechaSalida: dia(4) }));
    assert.equal(invertida.status, 400);
    // Campos no esperados (p. ej. un precio enviado desde el navegador) se rechazan
    assert.equal((await enviar(solicitud({ precio: 1000 }))).status, 400);
    assert.equal(await prisma.reserva.count(), 0);
  });

  it('repetir el envío con la misma clave no duplica; con otros datos responde 422', async () => {
    const clave = randomUUID();
    const a = await enviar(solicitud(), clave);
    const b = await enviar(solicitud(), clave);
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(b.body.codigo, a.body.codigo);
    const c = await enviar(solicitud({ cantidadHuespedes: 3 }), clave);
    assert.equal(c.status, 422);
    assert.equal(await prisma.reserva.count(), 1);
  });

  it('la trampa para robots responde como éxito pero no guarda nada', async () => {
    const r = await enviar(solicitud({ sitioWeb: 'http://spam.example' }));
    assert.equal(r.status, 200);
    assert.equal(await prisma.reserva.count(), 0);
  });

  it('limita las solicitudes por IP', async () => {
    let ultimo = 0;
    for (let i = 0; i < 9; i++) ultimo = (await enviar(solicitud())).status;
    assert.equal(ultimo, 429);
  });
});

describe('datos públicos del hotel', () => {
  it('solo publica datos confirmados y publicados', async () => {
    const inicial = await peticion(srv.url, 'GET', '/publico/hotel');
    assert.equal(inicial.status, 200);
    // El seed guarda desayuno, parqueadero y Wi-Fi SIN confirmar: no aparecen
    assert.deepEqual(inicial.body.ajustes, {});

    const { token } = await sesion(srv.url, 'administrador');
    const sinConfirmar = await peticion(srv.url, 'PUT', '/admin/configuracion/ajustes/tarifas', {
      token,
      body: {
        valor: { items: [{ concepto: 'Sencilla', valor: '$ 100.000' }] },
        confirmado: false,
        publicado: true,
      },
    });
    assert.equal(sinConfirmar.status, 400);

    const guardado = await peticion(srv.url, 'PUT', '/admin/configuracion/ajustes/contacto', {
      token,
      body: {
        valor: { telefono: '6028200000', whatsapp: '57 300 000 0000' },
        confirmado: true,
        publicado: true,
      },
    });
    assert.equal(guardado.status, 200);
    assert.equal(guardado.body.valor.whatsapp, '573000000000');
    const despues = await peticion(srv.url, 'GET', '/publico/hotel');
    assert.equal(despues.body.ajustes.contacto.telefono, '6028200000');
    assert.equal(despues.body.ajustes.tarifas, undefined);
  });

  it('la disponibilidad pública es orientativa y no expone reservas', async () => {
    // Los tipos iniciales no se publican hasta que la administración los confirma
    await prisma.tipoHabitacion.update({ where: { nombre: 'Doble' }, data: { publicado: true } });
    const h = await crearHabitacion(2, 'Doble');
    const { token } = await sesion(srv.url, 'recepcion');
    const libre = await peticion(
      srv.url,
      'GET',
      `/publico/disponibilidad?fechaEntrada=${dia(3)}&fechaSalida=${dia(5)}&cantidadHuespedes=2`,
    );
    assert.equal(libre.body.hayDisponibilidad, true);
    assert.equal(
      libre.body.porTipo.find((t: { nombre: string }) => t.nombre === 'Doble').disponible,
      true,
    );

    await crearReservaApi(srv.url, token, {
      entrada: dia(3),
      salida: dia(5),
      camaIds: [h.camas[0]!.id],
    });
    const ocupada = await peticion(
      srv.url,
      'GET',
      `/publico/disponibilidad?fechaEntrada=${dia(3)}&fechaSalida=${dia(5)}&cantidadHuespedes=2`,
    );
    assert.equal(ocupada.body.hayDisponibilidad, false);
    assert.ok(!JSON.stringify(ocupada.body).includes('HR-'));
  });
});
