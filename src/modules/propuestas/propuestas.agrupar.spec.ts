import { agruparPropuestas, estadoResuelto } from './propuestas.agrupar.js';
import type { PropuestaGuardada } from './propuestas.agrupar.js';
import type { EstadoPropuesta } from './propuesta.schema.js';

function propuesta(
  clave: string,
  turnoId: string,
  round: number,
  creadoEn: string,
  estado: EstadoPropuesta = 'pendiente',
): PropuestaGuardada {
  return {
    proyectoId: 7,
    turnoId,
    mensajeId: null,
    clavePropuesta: clave,
    toolName: 'addClass',
    args: {},
    round,
    estado,
    solicitadoPor: { usuarioId: 1, nombre: 'Ana' },
    modelo: 'modelo-x',
    aprobadoPor: null,
    reclamadaEn: null,
    resueltaEn: null,
    resultado: null,
    creadoEn: new Date(creadoEn),
  };
}

describe('agruparPropuestas', () => {
  it('agrupa por turno, ordena turnos por antigüedad y herramientas por ronda', () => {
    const turnos = agruparPropuestas([
      propuesta('b', 'turno-nuevo', 1, '2026-10-30T12:00:02.000Z'),
      propuesta('a', 'turno-nuevo', 0, '2026-10-30T12:00:01.000Z'),
      propuesta('c', 'turno-viejo', 0, '2026-10-29T09:00:00.000Z'),
    ]);

    expect(turnos.map((turno) => turno.turnoId)).toEqual(['turno-viejo', 'turno-nuevo']);
    expect(turnos[1].propuestas.map((p) => p.clavePropuesta)).toEqual(['a', 'b']);
    expect(turnos[1].resumen).toBe('2 cambio(s): addClass');
    expect(turnos[1].solicitadoPor.nombre).toBe('Ana');
  });

  it('expone el aprobador y el resultado del turno', () => {
    const aprobada = propuesta('a', 'turno-1', 0, '2026-10-30T12:00:00.000Z', 'aplicada');
    aprobada.aprobadoPor = { usuarioId: 9, nombre: 'Luis' };
    aprobada.reclamadaEn = new Date('2026-10-30T12:01:00.000Z');
    aprobada.resueltaEn = new Date('2026-10-30T12:02:00.000Z');
    aprobada.resultado = { aplicadas: 1, errores: [] };

    const [turno] = agruparPropuestas([aprobada]);

    expect(turno.estado).toBe('aplicada');
    expect(turno.aprobadoPor?.nombre).toBe('Luis');
    expect(turno.resultado).toEqual({ aplicadas: 1, errores: [] });
  });

  it('un turno con estados mezclados se presenta como pendiente', () => {
    const [turno] = agruparPropuestas([
      propuesta('a', 'turno-1', 0, '2026-10-30T12:00:00.000Z', 'aplicada'),
      propuesta('b', 'turno-1', 1, '2026-10-30T12:00:01.000Z', 'pendiente'),
    ]);

    expect(turno.estado).toBe('pendiente');
  });
});

describe('estadoResuelto', () => {
  it.each<EstadoPropuesta>(['aplicada', 'error', 'rechazada'])(
    'considera resuelto el estado %s',
    (estado) => {
      expect(estadoResuelto(estado)).toBe(true);
    },
  );

  it.each<EstadoPropuesta>(['pendiente', 'aprobando'])(
    'no considera resuelto el estado %s',
    (estado) => {
      expect(estadoResuelto(estado)).toBe(false);
    },
  );
});
