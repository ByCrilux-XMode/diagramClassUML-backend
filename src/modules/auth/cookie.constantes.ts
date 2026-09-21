import type { Response } from 'express';

export const COOKIE_TOKEN = 'tokenAcceso';

export interface OpcionesCookie {
  httpOnly: boolean;
  sameSite: 'lax' | 'none';
  secure: boolean;
  path: string;
  maxAge: number;
}

export function calcularMaxAgeMs(expiraEn: string): number {
  const coincidencia = /^(\d+)([dhmsw]?)$/.exec(expiraEn.trim());
  if (!coincidencia) {
    return 24 * 60 * 60 * 1000;
  }
  const cantidad = Number(coincidencia[1] ?? '1');
  const unidad = coincidencia[2] ?? 'h';
  const multiplicadores: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return cantidad * (multiplicadores[unidad] ?? 60 * 60 * 1000);
}

export function crearOpcionesCookie(esSeguro: boolean, maxAgeMs: number): OpcionesCookie {
  return {
    httpOnly: true,
    sameSite: esSeguro ? 'none' : 'lax',
    secure: esSeguro,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function establecerCookie(respuesta: Response, token: string, esSeguro: boolean, maxAgeMs: number): void {
  respuesta.cookie(COOKIE_TOKEN, token, crearOpcionesCookie(esSeguro, maxAgeMs));
}

export function eliminarCookie(respuesta: Response): void {
  respuesta.clearCookie(COOKIE_TOKEN, { path: '/' });
}