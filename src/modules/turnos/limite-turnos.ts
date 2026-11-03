import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Entorno } from '../../config/env.schema.js';

/**
 * Límite de turnos por usuario y proyecto (fase 9, D66/D67).
 *
 * Se aplica en Nest, antes de validar el permiso y de crear el turno, para que
 * un rechazo por frecuencia no deje un turno huérfano ni toque el índice único
 * parcial. `IA_LIMITE_TURNOS_MINUTO=0` desactiva solo la frecuencia.
 */

export const TTL_TURNOS_MS = 60_000;
export const LIMITE_TURNOS_DEFECTO = 10;
export const MENSAJE_LIMITE_TURNOS =
  'Has alcanzado el límite de turnos de IA. Espera un momento y vuelve a intentarlo.';

export function limiteTurnos(configService: ConfigService<Entorno, true>): number {
  const valor = configService.get('IA_LIMITE_TURNOS_MINUTO') ?? LIMITE_TURNOS_DEFECTO;
  if (!Number.isFinite(valor)) return LIMITE_TURNOS_DEFECTO;
  return Math.max(0, Math.floor(valor));
}

/**
 * Clave del cubo: usuario + proyecto. Las IPs se descartan porque un aula
 * comparte salida NAT y el identificador de usuario ya es estable.
 */
export function claveTrackerTurnos(peticion: Record<string, unknown>): string {
  const usuario = peticion.user as { usuarioId?: number } | undefined;
  const usuarioId = usuario?.usuarioId ?? 'anon';
  const params = peticion.params as Record<string, unknown> | undefined;
  const proyectoId = params?.id ?? params?.proyectoId ?? 'sin-proyecto';
  return `${usuarioId}:${proyectoId}`;
}

export function opcionesThrottlerTurnos(limite: number): ThrottlerModuleOptions {
  return {
    errorMessage: MENSAJE_LIMITE_TURNOS,
    getTracker: (peticion) => claveTrackerTurnos(peticion),
    // D66: cero desactiva solo la frecuencia; rol y modo se siguen validando.
    skipIf: () => limite <= 0,
    throttlers: [{ name: 'turnos', ttl: TTL_TURNOS_MS, limit: limite }],
  };
}
