import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import { ThrottlerException, ThrottlerGuard, ThrottlerStorageService } from '@nestjs/throttler';
import type { Entorno } from '../../config/env.schema.js';
import {
  LIMITE_TURNOS_DEFECTO,
  MENSAJE_LIMITE_TURNOS,
  TTL_TURNOS_MS,
  claveTrackerTurnos,
  limiteTurnos,
  opcionesThrottlerTurnos,
} from './limite-turnos.js';

function configCon(valor: number | undefined): ConfigService<Entorno, true> {
  return {
    get: (clave: string) => (clave === 'IA_LIMITE_TURNOS_MINUTO' ? valor : undefined),
  } as unknown as ConfigService<Entorno, true>;
}

describe('limiteTurnos', () => {
  it('usa 10 cuando la variable no está definida', () => {
    expect(limiteTurnos(configCon(undefined))).toBe(LIMITE_TURNOS_DEFECTO);
    expect(LIMITE_TURNOS_DEFECTO).toBe(10);
  });

  it('permite 0 para desactivar y recorta valores inválidos', () => {
    expect(limiteTurnos(configCon(0))).toBe(0);
    expect(limiteTurnos(configCon(25))).toBe(25);
    expect(limiteTurnos(configCon(-3))).toBe(0);
    expect(limiteTurnos(configCon(Number.NaN))).toBe(LIMITE_TURNOS_DEFECTO);
  });
});

describe('claveTrackerTurnos', () => {
  it('usa usuario y proyecto, no la IP', () => {
    expect(
      claveTrackerTurnos({ user: { usuarioId: 7 }, params: { id: '42' }, ip: '10.0.0.1' }),
    ).toBe('7:42');
  });

  it('tolera una petición sin usuario o sin proyecto', () => {
    expect(claveTrackerTurnos({ params: { id: '42' } })).toBe('anon:42');
    expect(claveTrackerTurnos({ user: { usuarioId: 7 } })).toBe('7:sin-proyecto');
  });
});

describe('opcionesThrottlerTurnos', () => {
  it('configura 60 s, el mensaje en español y el tracker por usuario', async () => {
    const opciones = opcionesThrottlerTurnos(10);

    expect(Array.isArray(opciones)).toBe(false);
    if (Array.isArray(opciones)) throw new Error('se esperaba la forma con throttlers');

    expect(opciones.errorMessage).toBe(MENSAJE_LIMITE_TURNOS);
    expect(opciones.throttlers).toEqual([
      expect.objectContaining({ name: 'turnos', ttl: TTL_TURNOS_MS, limit: 10 }),
    ]);
    expect(await opciones.getTracker?.({ user: { usuarioId: 7 }, params: { id: '4' } }, {} as ExecutionContext)).toBe(
      '7:4',
    );
    expect(opciones.skipIf?.({} as ExecutionContext)).toBe(false);
  });

  it('cero desactiva solo la frecuencia', () => {
    const opciones = opcionesThrottlerTurnos(0);
    if (Array.isArray(opciones)) throw new Error('se esperaba la forma con throttlers');

    expect(opciones.skipIf?.({} as ExecutionContext)).toBe(true);
  });
});

describe('ThrottlerGuard aplicado al claim', () => {
  function contexto(usuarioId: number, proyectoId: string) {
    const req = {
      user: { usuarioId },
      params: { id: proyectoId },
      headers: {},
      ip: '10.0.0.1',
    };
    const res = { header: vi.fn() };
    const context = {
      getHandler: () => function reclamar() {},
      getClass: () => class TurnosController {},
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
    return { context, res };
  }

  it('rechaza el turno 3 con Retry-After y no toca el servicio', async () => {
    const guardia = new ThrottlerGuard(
      opcionesThrottlerTurnos(2),
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guardia.onModuleInit();
    const reclamar = vi.fn();

    for (let i = 0; i < 2; i++) {
      expect(await guardia.canActivate(contexto(7, '42').context)).toBe(true);
      reclamar();
    }

    const tercero = contexto(7, '42');
    await expect(guardia.canActivate(tercero.context)).rejects.toBeInstanceOf(ThrottlerException);
    expect(tercero.res.header).toHaveBeenCalledWith('Retry-After-turnos', expect.any(Number));
    expect(reclamar).toHaveBeenCalledTimes(2);
  });

  it('aísla el cupo por usuario y por proyecto', async () => {
    const guardia = new ThrottlerGuard(
      opcionesThrottlerTurnos(1),
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guardia.onModuleInit();

    expect(await guardia.canActivate(contexto(7, '42').context)).toBe(true);
    await expect(guardia.canActivate(contexto(7, '42').context)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
    // Otro usuario en el mismo proyecto conserva su cupo.
    expect(await guardia.canActivate(contexto(8, '42').context)).toBe(true);
    // El mismo usuario en otro proyecto también.
    expect(await guardia.canActivate(contexto(7, '43').context)).toBe(true);
  });

  it('con límite 0 no rechaza nunca', async () => {
    const guardia = new ThrottlerGuard(
      opcionesThrottlerTurnos(0),
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guardia.onModuleInit();

    for (let i = 0; i < 20; i++) {
      expect(await guardia.canActivate(contexto(7, '42').context)).toBe(true);
    }
  });
});
