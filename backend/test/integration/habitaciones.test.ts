import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
let admin: string;
let recepcion: string;

before(async () => {
  srv = await iniciarServidor();
});
after(async () => {
  await srv.cerrar();
});
beforeEach(async () => {
  await prepararBd();
  admin = (await sesion(srv.url, 'administrador')).token;
  recepcion = (await sesion(srv.url, 'recepcion')).token;
});

async function tipoId(nombre = 'Doble') {
  return (await prisma.tipoHabitacion.findUniqueOrThrow({ where: { nombre } })).id;
}

const bloquear = (token: string, body: Record<string, unknown>) =>
  peticion(srv.url, 'POST', '/admin/bloqueos', { token, body });

describe('habitaciones y camas configurables', () => {
  it('el personal configura la distribución sin tocar código (20 habitaciones, 37 camas)', async () => {
    const tipo = await tipoId();
    // 17 habitaciones de 2 camas + 3 de 1 cama = 20 habitaciones y 37 camas
    for (let i = 0; i < 20; i++) {
      const camas = i < 17 ? 2 : 1;
      const r = await peticion(srv.url, 'POST', '/admin/habitaciones', {
        token: admin,
        body: {
          numero: String(101 + i),
          tipoHabitacionId: tipo,
          capacidad: camas,
          camas: Array.from({ length: camas }, (_, j) => ({
            identificador: String.fromCharCode(65 + j),
            tipo: 'SENCILLA',
          })),
        },
      });
      assert.equal(r.status, 201);
    }
    const lista = await peticion(srv.url, 'GET', '/admin/habitaciones', { token: recepcion });
    assert.deepEqual(lista.body.resumen, { habitaciones: 20, camas: 37, plazas: 37 });

    // Cambiar la distribución: una cama más en la 118
    const h = lista.body.habitaciones.find((x: { numero: string }) => x.numero === '118');
    const cama = await peticion(srv.url, 'POST', `/admin/habitaciones/${h.id}/camas`, {
      token: admin,
      body: { identificador: 'B', tipo: 'DOBLE', plazas: 2 },
    });
    assert.equal(cama.status, 201);
    const despues = await peticion(srv.url, 'GET', '/admin/habitaciones', { token: recepcion });
    assert.deepEqual(despues.body.resumen, { habitaciones: 20, camas: 38, plazas: 39 });
  });

  it('rechaza números de habitación repetidos y camas repetidas', async () => {
    const tipo = await tipoId();
    const body = { numero: '301', tipoHabitacionId: tipo, capacidad: 2 };
    assert.equal(
      (await peticion(srv.url, 'POST', '/admin/habitaciones', { token: admin, body })).status,
      201,
    );
    const repetida = await peticion(srv.url, 'POST', '/admin/habitaciones', { token: admin, body });
    assert.equal(repetida.status, 409);
    assert.equal(repetida.body.error.code, 'NUMERO_REPETIDO');
  });

  it('recepción no puede crear habitaciones (permiso habitaciones:gestionar)', async () => {
    const r = await peticion(srv.url, 'POST', '/admin/habitaciones', {
      token: recepcion,
      body: { numero: '401', tipoHabitacionId: await tipoId(), capacidad: 1 },
    });
    assert.equal(r.status, 403);
  });

  it('no se puede retirar una cama con reservas vigentes', async () => {
    const h = await crearHabitacion(1);
    await crearReservaApi(srv.url, recepcion, {
      entrada: dia(2),
      salida: dia(4),
      camaIds: [h.camas[0]!.id],
    });
    const r = await peticion(
      srv.url,
      'PATCH',
      `/admin/habitaciones/${h.id}/camas/${h.camas[0]!.id}`,
      {
        token: admin,
        body: { activa: false },
      },
    );
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TIENE_RESERVAS');
  });
});

describe('bloqueos y mantenimiento', () => {
  it('una cama en mantenimiento no se puede asignar en ese periodo', async () => {
    const h = await crearHabitacion(2);
    const cama = h.camas[0]!.id;
    const b = await bloquear(recepcion, {
      tipo: 'MANTENIMIENTO',
      habitacionId: h.id,
      camaId: cama,
      fechaInicio: dia(5),
      fechaFin: dia(8),
      motivo: 'Reparación de la base',
    });
    assert.equal(b.status, 201);
    assert.equal(b.body.alcance, 'CAMA');

    const choque = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(7),
      salida: dia(9),
      camaIds: [cama],
    });
    assert.equal(choque.status, 409);
    assert.match(choque.body.error.details[0].message, /mantenimiento/);

    // Otra cama de la misma habitación sí está libre; y la misma cama, después del bloqueo
    const otra = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(7),
      salida: dia(9),
      camaIds: [h.camas[1]!.id],
    });
    assert.equal(otra.status, 201);
    const despues = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(8),
      salida: dia(9),
      camaIds: [cama],
    });
    assert.equal(despues.status, 201);
  });

  it('no se puede bloquear una cama que ya tiene reservas en el periodo', async () => {
    const h = await crearHabitacion(1);
    const r = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(10),
      salida: dia(12),
      camaIds: [h.camas[0]!.id],
    });
    const b = await bloquear(recepcion, {
      tipo: 'BLOQUEO',
      habitacionId: h.id,
      fechaInicio: dia(11),
      motivo: 'Evento privado',
    });
    assert.equal(b.status, 409);
    assert.match(b.body.error.details[0].message, new RegExp(r.body.codigo));
    assert.equal(await prisma.bloqueo.count(), 0);
  });

  it('el bloqueo de una habitación sin fecha de fin aplica a las camas que se agreguen', async () => {
    const h = await crearHabitacion(1);
    const b = await bloquear(recepcion, {
      tipo: 'MANTENIMIENTO',
      habitacionId: h.id,
      fechaInicio: dia(0),
      motivo: 'Remodelación del baño',
    });
    assert.equal(b.status, 201);
    assert.equal(b.body.fechaFin, null);

    const nueva = await peticion(srv.url, 'POST', `/admin/habitaciones/${h.id}/camas`, {
      token: admin,
      body: { identificador: 'B', tipo: 'SENCILLA' },
    });
    const camaNueva = nueva.body.camas.find(
      (c: { identificador: string }) => c.identificador === 'B',
    );
    const choque = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(100),
      salida: dia(101),
      camaIds: [camaNueva.id],
    });
    assert.equal(choque.status, 409);

    const mapa = await peticion(
      srv.url,
      'GET',
      `/admin/disponibilidad?desde=${dia(0)}&hasta=${dia(7)}`,
      {
        token: recepcion,
      },
    );
    const hab = mapa.body.habitaciones.find((x: { id: string }) => x.id === h.id);
    assert.equal(hab.estado, 'FUERA_DE_SERVICIO');
    assert.ok(hab.camas.every((c: { estado: string }) => c.estado === 'MANTENIMIENTO'));
  });

  it('liberar un bloqueo devuelve la cama a disponible desde hoy y queda en la auditoría', async () => {
    const h = await crearHabitacion(1);
    const b = await bloquear(recepcion, {
      tipo: 'BLOQUEO',
      habitacionId: h.id,
      fechaInicio: dia(-3),
      fechaFin: dia(10),
      motivo: 'Fumigación',
    });
    const liberado = await peticion(srv.url, 'POST', `/admin/bloqueos/${b.body.id}/liberar`, {
      token: recepcion,
    });
    assert.equal(liberado.status, 200);
    assert.equal(liberado.body.fechaFin, dia(0));
    const otraVez = await peticion(srv.url, 'POST', `/admin/bloqueos/${b.body.id}/liberar`, {
      token: recepcion,
    });
    assert.equal(otraVez.status, 409);

    const r = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(0),
      salida: dia(2),
      camaIds: [h.camas[0]!.id],
    });
    assert.equal(r.status, 201);
    assert.equal(
      await prisma.auditoria.count({ where: { entidadId: b.body.id, accion: 'bloqueo.liberado' } }),
      1,
    );
  });
});

describe('disponibilidad calculada en el servidor', () => {
  it('muestra el estado de cada cama y lista solo camas libres', async () => {
    const h = await crearHabitacion(3);
    const [a, b, c] = h.camas.map((x) => x.id) as [string, string, string];
    const r = await crearReservaApi(srv.url, recepcion, {
      entrada: dia(0),
      salida: dia(2),
      camaIds: [a],
    });
    await peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/estado`, {
      token: recepcion,
      body: { estado: 'CONFIRMADA' },
    });
    await crearReservaApi(srv.url, recepcion, {
      entrada: dia(0),
      salida: dia(2),
      camaIds: [b],
      estadoInicial: 'SOLICITUD',
    });

    const mapa = await peticion(
      srv.url,
      'GET',
      `/admin/disponibilidad?desde=${dia(0)}&hasta=${dia(3)}`,
      {
        token: recepcion,
      },
    );
    const hab = mapa.body.habitaciones.find((x: { id: string }) => x.id === h.id);
    const estados = Object.fromEntries(
      hab.camas.map((x: { id: string; estado: string }) => [x.id, x.estado]),
    );
    assert.deepEqual(estados, { [a]: 'OCUPADA', [b]: 'RETENIDA', [c]: 'DISPONIBLE' });
    assert.equal(hab.estado, 'PARCIAL');

    const libres = await peticion(
      srv.url,
      'GET',
      `/admin/disponibilidad/camas-libres?fechaEntrada=${dia(1)}&fechaSalida=${dia(3)}`,
      { token: recepcion },
    );
    const ids = libres.body.habitaciones.flatMap((x: { camas: Array<{ id: string }> }) =>
      x.camas.map((y) => y.id),
    );
    assert.deepEqual(ids, [c]);
  });

  it('rechaza rangos de más de 62 días en el mapa', async () => {
    const r = await peticion(
      srv.url,
      'GET',
      `/admin/disponibilidad?desde=${dia(0)}&hasta=${dia(90)}`,
      {
        token: recepcion,
      },
    );
    assert.equal(r.status, 400);
  });
});
