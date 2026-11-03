import type {
  EstadoPropuesta,
  PersonaPropuesta,
  Propuesta,
  ResultadoPropuesta,
} from './propuesta.schema.js';

export type PropuestaGuardada = Propuesta & { _id?: unknown };

export interface TurnoAgrupado {
  turnoId: string;
  estado: EstadoPropuesta;
  mensajeId: string | null;
  solicitadoPor: PersonaPropuesta;
  modelo: string | null;
  aprobadoPor: PersonaPropuesta | null;
  reclamadaEn: Date | null;
  resueltaEn: Date | null;
  resultado: ResultadoPropuesta | null;
  creadoEn: Date;
  resumen: string;
  propuestas: PropuestaGuardada[];
}

function tiempo(valor: Date | string | null | undefined): number {
  if (!valor) return 0;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
}

/** El estado del turno es el más restrictivo de sus herramientas. */
function estadoDelTurno(propuestas: PropuestaGuardada[]): EstadoPropuesta {
  const estados = new Set(propuestas.map((propuesta) => propuesta.estado));
  if (estados.size === 1) return propuestas[0].estado;
  if (estados.has('pendiente')) return 'pendiente';
  if (estados.has('aprobando')) return 'aprobando';
  if (estados.has('error')) return 'error';
  if (estados.has('rechazada')) return 'rechazada';
  return 'aplicada';
}

function resumenDelTurno(propuestas: PropuestaGuardada[]): string {
  const nombres = [...new Set(propuestas.map((propuesta) => propuesta.toolName))];
  const listados = nombres.slice(0, 5).join(', ');
  const resto = nombres.length > 5 ? ` y ${nombres.length - 5} más` : '';
  return `${propuestas.length} cambio(s): ${listados}${resto}`;
}

/**
 * Agrupa los documentos por turno y ordena los turnos por antigüedad (el más
 * viejo primero) y las herramientas por ronda. Es la forma en que el panel
 * presenta la unidad que se aprueba o rechaza.
 */
export function agruparPropuestas(propuestas: PropuestaGuardada[]): TurnoAgrupado[] {
  const grupos = new Map<string, PropuestaGuardada[]>();
  for (const propuesta of propuestas) {
    const lista = grupos.get(propuesta.turnoId);
    if (lista) lista.push(propuesta);
    else grupos.set(propuesta.turnoId, [propuesta]);
  }

  const turnos: TurnoAgrupado[] = [];
  for (const [turnoId, lista] of grupos) {
    const ordenadas = [...lista].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return tiempo(a.creadoEn) - tiempo(b.creadoEn);
    });
    const primera = ordenadas[0];
    const conAprobador = ordenadas.find((propuesta) => propuesta.aprobadoPor);
    const conResultado = ordenadas.find((propuesta) => propuesta.resultado);
    turnos.push({
      turnoId,
      estado: estadoDelTurno(ordenadas),
      mensajeId: primera.mensajeId,
      solicitadoPor: primera.solicitadoPor,
      modelo: primera.modelo,
      aprobadoPor: conAprobador?.aprobadoPor ?? null,
      reclamadaEn: conAprobador?.reclamadaEn ?? null,
      resueltaEn: conResultado?.resueltaEn ?? null,
      resultado: conResultado?.resultado ?? null,
      creadoEn: primera.creadoEn,
      resumen: resumenDelTurno(ordenadas),
      propuestas: ordenadas,
    });
  }

  return turnos.sort((a, b) => tiempo(a.creadoEn) - tiempo(b.creadoEn));
}

/** Un turno está resuelto cuando ya no admite otra decisión. */
export function estadoResuelto(estado: EstadoPropuesta): boolean {
  return estado === 'aplicada' || estado === 'error' || estado === 'rechazada';
}
