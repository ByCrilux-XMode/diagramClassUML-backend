import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

export enum TipoAccionProyecto {
  PROYECTO_GUARDADO = 'PROYECTO_GUARDADO',
  VERSION_RESTAURADA = 'VERSION_RESTAURADA',
}

export interface ContextoAccionProyecto {
  actor: Usuario;
  proyecto: Proyecto;
  versionId?: number;
  nombreVersion?: string;
}

export interface PlantillaNotificacion {
  titulo: string;
  mensaje: string;
}

export type GeneradorPlantillaNotificacion = (contexto: ContextoAccionProyecto) => PlantillaNotificacion;

export function nombreCompleto(usuario: Usuario): string {
  const nombre = [usuario.persona?.nombre, usuario.persona?.apellido]
    .filter((parte): parte is string => Boolean(parte))
    .join(' ')
    .trim();
  return nombre || usuario.username;
}

export const PLANTILLAS_ACCION_PROYECTO: Record<TipoAccionProyecto, GeneradorPlantillaNotificacion> = {
  [TipoAccionProyecto.PROYECTO_GUARDADO]: ({ actor, proyecto }) => ({
    titulo: 'Proyecto guardado',
    mensaje: `${nombreCompleto(actor)} guardó el proyecto "${proyecto.nombre}".`,
  }),
  [TipoAccionProyecto.VERSION_RESTAURADA]: ({ actor, proyecto, nombreVersion }) => ({
    titulo: 'Versión restaurada',
    mensaje: `${nombreCompleto(actor)} restauró la versión "${nombreVersion ?? 'sin nombre'}" del proyecto "${proyecto.nombre}".`,
  }),
};
