import type { Response } from 'express';

export const COOKIE_TOKEN = 'tokenAcceso';

export interface OpcionesCookie {
  httpOnly: boolean;
  sameSite: 'lax' | 'none';
  secure: boolean;
  path: string;
  maxAge: number;
  domain?: string;
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

export function crearOpcionesCookie(
  esSeguro: boolean,
  maxAgeMs: number,
  dominio?: string | null,
): OpcionesCookie {
  const opciones: OpcionesCookie = {
    httpOnly: true,
    sameSite: esSeguro ? 'none' : 'lax',
    secure: esSeguro,
    path: '/',
    maxAge: maxAgeMs,
  };
  const domain = dominio?.trim();
  if (domain) opciones.domain = domain;
  return opciones;
}

export function establecerCookie(
  respuesta: Response,
  token: string,
  esSeguro: boolean,
  maxAgeMs: number,
  dominio?: string | null,
): void {
  respuesta.cookie(COOKIE_TOKEN, token, crearOpcionesCookie(esSeguro, maxAgeMs, dominio));
}

export function eliminarCookie(respuesta: Response, dominio?: string | null): void {
  const domain = dominio?.trim();
  respuesta.clearCookie(COOKIE_TOKEN, {
    path: '/',
    ...(domain ? { domain } : {}),
  });
}