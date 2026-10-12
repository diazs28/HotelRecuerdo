import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diasEntre, hoyEnHotel, noches, sumarDias, sumarMeses } from './fechas.ts';
import { accionesDisponibles } from './estados.ts';

describe('fechas del hotel en el navegador', () => {
  it('usa la zona horaria de Bogotá', () => {
    assert.equal(hoyEnHotel(new Date('2026-10-13T03:00:00Z')), '2026-10-12');
  });
  it('cuenta noches y días del rango', () => {
    assert.equal(noches('2026-10-12', '2026-10-15'), 3);
    assert.deepEqual(diasEntre('2026-12-30', '2027-01-02'), [
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
    assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
    assert.equal(sumarMeses('2026-12-15', 1), '2027-01-01');
  });
});

describe('acciones por estado', () => {
  it('ofrece solo las transiciones válidas', () => {
    assert.deepEqual(
      accionesDisponibles('SOLICITUD').map((a) => a.estado),
      ['PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'CANCELADA'],
    );
    assert.deepEqual(accionesDisponibles('FINALIZADA'), []);
  });
});
