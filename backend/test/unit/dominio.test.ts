import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esFechaValida,
  hoyEnHotel,
  incluyeNoche,
  noches,
  rangosSeCruzan,
  sumarDias,
  validarRangoEstancia,
} from '../../src/domain/fechas.js';
import {
  ESTADOS_RESERVA,
  TRANSICIONES,
  capacidadSuficiente,
  codigoReserva,
  numeroDesdeCodigo,
  puedeTransicionar,
} from '../../src/domain/estadosReserva.js';
import { estadoCamaEnNoche, estadoHabitacion } from '../../src/domain/ocupacion.js';
import { enmascarar, enmascararEmail, presentarHuesped } from '../../src/domain/privacidad.js';

describe('fechas del hotel', () => {
  it('valida fechas de calendario reales', () => {
    assert.equal(esFechaValida('2026-10-12'), true);
    assert.equal(esFechaValida('2028-02-29'), true);
    assert.equal(esFechaValida('2026-02-30'), false);
    assert.equal(esFechaValida('2026-13-01'), false);
    assert.equal(esFechaValida('12/10/2026'), false);
  });

  it('calcula "hoy" en la zona horaria de Bogotá, no la del servidor', () => {
    // 03:00 UTC del 13 de octubre = 22:00 del 12 de octubre en Bogotá (UTC-5)
    assert.equal(hoyEnHotel(new Date('2026-10-13T03:00:00Z')), '2026-10-12');
    assert.equal(hoyEnHotel(new Date('2026-10-13T05:00:00Z')), '2026-10-13');
  });

  it('cuenta noches entre entrada y salida (la salida no es noche)', () => {
    assert.equal(noches('2026-10-12', '2026-10-15'), 3);
    assert.equal(noches('2026-12-31', '2027-01-01'), 1);
    assert.equal(sumarDias('2026-02-28', 1), '2026-03-01');
  });

  it('la salida de una reserva puede ser la entrada de otra (no se cruzan)', () => {
    assert.equal(rangosSeCruzan('2026-10-10', '2026-10-12', '2026-10-12', '2026-10-14'), false);
    assert.equal(rangosSeCruzan('2026-10-10', '2026-10-13', '2026-10-12', '2026-10-14'), true);
    assert.equal(rangosSeCruzan('2026-10-10', '2026-10-20', '2026-10-12', '2026-10-14'), true);
  });

  it('un bloqueo sin fecha de fin se cruza con todo lo posterior a su inicio', () => {
    assert.equal(rangosSeCruzan('2026-10-10', null, '2027-05-01', '2027-05-03'), true);
    assert.equal(rangosSeCruzan('2026-10-10', null, '2026-10-01', '2026-10-10'), false);
    assert.equal(incluyeNoche('2026-10-10', null, '2030-01-01'), true);
    assert.equal(incluyeNoche('2026-10-10', '2026-10-12', '2026-10-12'), false);
  });

  it('exige salida posterior a la entrada y una estancia máxima', () => {
    assert.equal(validarRangoEstancia('2026-10-12', '2026-10-12'), 'SALIDA_NO_POSTERIOR');
    assert.equal(validarRangoEstancia('2026-10-12', '2026-10-11'), 'SALIDA_NO_POSTERIOR');
    assert.equal(validarRangoEstancia('2026-10-12', '2027-10-13'), 'ESTANCIA_DEMASIADO_LARGA');
    assert.equal(validarRangoEstancia('2026-10-12', '2026-10-13'), null);
  });
});

describe('flujo de estados de la reserva', () => {
  it('permite el flujo sugerido', () => {
    assert.ok(puedeTransicionar('SOLICITUD', 'PENDIENTE_CONFIRMACION'));
    assert.ok(puedeTransicionar('SOLICITUD', 'CONFIRMADA'));
    assert.ok(puedeTransicionar('PENDIENTE_CONFIRMACION', 'CONFIRMADA'));
    assert.ok(puedeTransicionar('CONFIRMADA', 'EN_ALOJAMIENTO'));
    assert.ok(puedeTransicionar('EN_ALOJAMIENTO', 'FINALIZADA'));
  });

  it('rechaza saltos y retrocesos', () => {
    assert.equal(puedeTransicionar('SOLICITUD', 'EN_ALOJAMIENTO'), false);
    assert.equal(puedeTransicionar('CONFIRMADA', 'SOLICITUD'), false);
    assert.equal(puedeTransicionar('EN_ALOJAMIENTO', 'CANCELADA'), false);
  });

  it('finalizada y cancelada son estados finales', () => {
    for (const e of ESTADOS_RESERVA) {
      assert.equal(puedeTransicionar('FINALIZADA', e), false);
      assert.equal(puedeTransicionar('CANCELADA', e), false);
    }
    assert.deepEqual(Object.keys(TRANSICIONES).sort(), [...ESTADOS_RESERVA].sort());
  });

  it('confirmar exige plazas suficientes', () => {
    assert.equal(capacidadSuficiente(0, 1), false);
    assert.equal(capacidadSuficiente(2, 3), false);
    assert.equal(capacidadSuficiente(3, 3), true);
  });

  it('genera y reconoce el código legible', () => {
    assert.equal(codigoReserva(42), 'HR-00042');
    assert.equal(numeroDesdeCodigo('HR-00042'), 42);
    assert.equal(numeroDesdeCodigo('hr42'), 42);
    assert.equal(numeroDesdeCodigo('42'), 42);
    assert.equal(numeroDesdeCodigo('Ana'), null);
  });
});

describe('estado de camas y habitaciones', () => {
  const reserva = (estado: 'SOLICITUD' | 'CONFIRMADA') => ({
    tipo: 'RESERVA' as const,
    fechaInicio: '2026-10-10',
    fechaFin: '2026-10-12',
    estadoReserva: estado,
  });

  it('distingue ocupada, retenida, bloqueada, mantenimiento y disponible', () => {
    assert.equal(estadoCamaEnNoche([reserva('CONFIRMADA')], '2026-10-11'), 'OCUPADA');
    assert.equal(estadoCamaEnNoche([reserva('SOLICITUD')], '2026-10-11'), 'RETENIDA');
    assert.equal(estadoCamaEnNoche([reserva('CONFIRMADA')], '2026-10-12'), 'DISPONIBLE');
    assert.equal(
      estadoCamaEnNoche(
        [
          {
            tipo: 'BLOQUEO',
            fechaInicio: '2026-10-01',
            fechaFin: null,
            tipoBloqueo: 'MANTENIMIENTO',
          },
        ],
        '2026-12-01',
      ),
      'MANTENIMIENTO',
    );
  });

  it('resume la habitación según sus camas', () => {
    assert.equal(estadoHabitacion(['DISPONIBLE', 'DISPONIBLE']), 'DISPONIBLE');
    assert.equal(estadoHabitacion(['OCUPADA', 'DISPONIBLE']), 'PARCIAL');
    assert.equal(estadoHabitacion(['OCUPADA', 'RETENIDA']), 'OCUPADA');
    assert.equal(estadoHabitacion(['OCUPADA', 'MANTENIMIENTO']), 'OCUPADA');
    assert.equal(estadoHabitacion(['BLOQUEADA', 'MANTENIMIENTO']), 'FUERA_DE_SERVICIO');
    assert.equal(estadoHabitacion([]), 'FUERA_DE_SERVICIO');
  });
});

describe('privacidad', () => {
  it('enmascara contacto y documento según permisos', () => {
    assert.equal(enmascarar('3001234567'), '••••••••67');
    assert.equal(enmascararEmail('ana.perez@correo.com'), 'a•••@correo.com');
    const h = {
      id: 'x',
      nombres: 'Ana',
      apellidos: 'Pérez',
      telefono: '3001234567',
      email: 'ana@correo.com',
      tipoDocumento: 'CC',
      numeroDocumento: '1061234567',
      anonimizadoEn: null,
    };
    const restringido = presentarHuesped(h, { verContacto: false, verDocumento: false });
    assert.equal(restringido.telefono, '••••••••67');
    assert.equal(restringido.numeroDocumento, '••••••4567');
    assert.equal(restringido.datosRestringidos, true);
    const completo = presentarHuesped(h, { verContacto: true, verDocumento: true });
    assert.equal(completo.numeroDocumento, '1061234567');
  });
});
