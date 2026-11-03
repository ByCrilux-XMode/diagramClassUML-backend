import type { Response } from 'express';
import {
  COOKIE_TOKEN,
  calcularMaxAgeMs,
  crearOpcionesCookie,
  eliminarCookie,
  establecerCookie,
} from './cookie.constantes.js';

describe('crearOpcionesCookie', () => {
  it('sin dominio mantiene httpOnly, sameSite lax y path /', () => {
    const opciones = crearOpcionesCookie(false, 60_000);

    expect(opciones).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60_000,
    });
    expect(opciones).not.toHaveProperty('domain');
  });

  it('con dominio lo añade sin relajar el resto de la cookie', () => {
    const opciones = crearOpcionesCookie(true, 120_000, '.midominio.com');

    expect(opciones).toMatchObject({
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 120_000,
      domain: '.midominio.com',
    });
  });

  it('ignora un dominio vacío o con espacios', () => {
    expect(crearOpcionesCookie(false, 1, '   ')).not.toHaveProperty('domain');
    expect(crearOpcionesCookie(false, 1, '  .x.com  ')).toHaveProperty('domain', '.x.com');
  });
});

describe('establecerCookie y eliminarCookie', () => {
  function respuestaMock() {
    return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
  }

  it('establecerCookie propaga el dominio', () => {
    const respuesta = respuestaMock();

    establecerCookie(respuesta, 'token', false, 1000, '.x.com');

    expect(respuesta.cookie).toHaveBeenCalledWith(
      COOKIE_TOKEN,
      'token',
      expect.objectContaining({ domain: '.x.com', httpOnly: true }),
    );
  });

  it('establecerCookie sin dominio no lo incluye', () => {
    const respuesta = respuestaMock();

    establecerCookie(respuesta, 'token', false, 1000);

    const [, , opciones] = (respuesta.cookie as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(opciones).not.toHaveProperty('domain');
  });

  it('eliminarCookie conserva path y añade el dominio solo si existe', () => {
    const conDominio = respuestaMock();
    const sinDominio = respuestaMock();

    eliminarCookie(conDominio, '.x.com');
    eliminarCookie(sinDominio);

    expect(conDominio.clearCookie).toHaveBeenCalledWith(COOKIE_TOKEN, {
      path: '/',
      domain: '.x.com',
    });
    expect(sinDominio.clearCookie).toHaveBeenCalledWith(COOKIE_TOKEN, { path: '/' });
  });
});

describe('calcularMaxAgeMs', () => {
  it.each([
    ['30s', 30_000],
    ['5m', 300_000],
    ['2h', 7_200_000],
    ['1d', 86_400_000],
    ['1w', 604_800_000],
    ['3', 10_800_000],
  ])('convierte %s', (expiraEn, esperado) => {
    expect(calcularMaxAgeMs(expiraEn)).toBe(esperado);
  });

  it('un valor inválido cae a 24 horas', () => {
    expect(calcularMaxAgeMs('mañana')).toBe(86_400_000);
  });
});
