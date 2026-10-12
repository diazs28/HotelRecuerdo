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

async function ocupacionesActivas(camaId: string) {
  return prisma.ocupacion.findMany({ where: { camaId, activa: true } });
}

describe('concurrencia: sin sobreventa', () => {
  it('10 reservas simultáneas para la misma cama y noches: solo una gana', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const respuestas = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        crearReservaApi(srv.url, token, {
          entrada: dia(20 + (i % 2)),
          salida: dia(23),
          camaIds: [cama],
        }),
      ),
    );
    const estados = respuestas.map((r) => r.status).sort();
    assert.equal(estados.filter((s) => s === 201).length, 1, `estados: ${estados.join(',')}`);
    assert.equal(estados.filter((s) => s === 409).length, 9);
    assert.equal((await ocupacionesActivas(cama)).length, 1);
    // Las 9 perdedoras no dejaron reservas ni huéspedes huérfanos
    assert.equal(await prisma.reserva.count(), 1);
    assert.equal(await prisma.huesped.count(), 1);
  });

  it('asignaciones simultáneas de la misma cama a reservas distintas: solo una gana', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const reservas = await Promise.all(
      Array.from({ length: 6 }, () =>
        crearReservaApi(srv.url, token, { entrada: dia(30), salida: dia(32) }),
      ),
    );
    const respuestas = await Promise.all(
      reservas.map((r) =>
        peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/camas`, {
          token,
          body: { camaIds: [cama] },
        }),
      ),
    );
    assert.equal(respuestas.filter((r) => r.status === 200).length, 1);
    assert.equal(respuestas.filter((r) => r.status === 409).length, 5);
    assert.equal((await ocupacionesActivas(cama)).length, 1);
  });

  it('un bloqueo y una reserva simultáneos sobre la misma cama: solo uno gana', async () => {
    const h = await crearHabitacion(1);
    const cama = h.camas[0]!.id;
    const [reserva, bloqueo] = await Promise.all([
      crearReservaApi(srv.url, token, { entrada: dia(40), salida: dia(42), camaIds: [cama] }),
      peticion(srv.url, 'POST', '/admin/bloqueos', {
        token,
        body: {
          tipo: 'MANTENIMIENTO',
          habitacionId: h.id,
          camaId: cama,
          fechaInicio: dia(41),
          fechaFin: dia(45),
          motivo: 'Cambio de colchón',
        },
      }),
    ]);
    const exitos = [reserva.status, bloqueo.status].filter((s) => s === 201).length;
    assert.equal(exitos, 1, `reserva=${reserva.status} bloqueo=${bloqueo.status}`);
    assert.equal((await ocupacionesActivas(cama)).length, 1);
  });

  it('cambios de estado simultáneos sobre la misma reserva: uno gana y el otro recibe 409', async () => {
    const h = await crearHabitacion(1);
    const r = await crearReservaApi(srv.url, token, {
      entrada: dia(5),
      salida: dia(6),
      camaIds: [h.camas[0]!.id],
    });
    const [a, b] = await Promise.all([
      peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/estado`, {
        token,
        body: { estado: 'CONFIRMADA' },
      }),
      peticion(srv.url, 'POST', `/admin/reservas/${r.body.id}/estado`, {
        token,
        body: { estado: 'CONFIRMADA' },
      }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const cambios = await prisma.auditoria.count({
      where: { entidadId: r.body.id, accion: 'reserva.estado' },
    });
    assert.equal(cambios, 1);
  });

  it('la misma solicitud pública enviada 5 veces a la vez crea una sola reserva', async () => {
    const body = {
      fechaEntrada: dia(15),
      fechaSalida: dia(17),
      cantidadHuespedes: 2,
      nombres: 'Luis',
      apellidos: 'Gómez',
      telefono: '3109876543',
      aceptaTratamientoDatos: true,
    };
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        peticion(srv.url, 'POST', '/publico/solicitudes', {
          body,
          headers: { 'Idempotency-Key': 'f3c1a9e2-5b7d-4c8e-9a1f-000000000001' },
        }),
      ),
    );
    const codigos = new Set(respuestas.map((r) => r.body.codigo));
    assert.equal(codigos.size, 1);
    assert.equal(await prisma.reserva.count(), 1);
    assert.ok(respuestas.every((r) => r.status === 201 || r.status === 200));
  });
});
