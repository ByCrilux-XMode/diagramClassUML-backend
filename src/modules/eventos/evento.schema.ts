import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type ActorTipo = 'humano' | 'ia' | 'sistema';
export type OrigenEvento = 'manual' | 'ia' | 'import' | 'vision';
export type AccionCambio = 'crear' | 'actualizar' | 'eliminar';
export type EntidadTipo = 'clase' | 'relacion' | 'atributo' | 'metodo';

export interface CambioEvento {
  accion: AccionCambio;
  entidadTipo: EntidadTipo;
  entidadKey: string;
  campo?: string;
  antes?: unknown;
  despues?: unknown;
}

export interface PersonaEvento {
  usuarioId: number;
  nombre: string;
}

/**
 * Un evento por transacción semántica. Es append-only: no se actualiza ni se
 * borra salvo la limpieza completa de un proyecto.
 */
@Schema({ collection: 'eventos', timestamps: false })
export class Evento {
  @Prop({ type: Number, required: true, index: true })
  proyectoId: number;

  @Prop({ type: String, required: true })
  sesionId: string;

  @Prop({ type: Number, required: true })
  secuencia: number;

  @Prop({ type: String, required: true, enum: ['humano', 'ia', 'sistema'] })
  actorTipo: ActorTipo;

  @Prop({ type: Number, default: null })
  actorUsuarioId: number | null;

  @Prop({ type: String, required: true })
  actorNombre: string;

  @Prop({ type: String, required: true, enum: ['manual', 'ia', 'import', 'vision'], default: 'manual' })
  origen: OrigenEvento;

  @Prop({ type: String, required: true })
  tipo: string;

  @Prop({ type: [String], default: [] })
  entidades: string[];

  @Prop({ type: [Object], default: [] })
  cambios: CambioEvento[];

  @Prop({ type: String, default: null })
  turnoId: string | null;

  /** Turno de IA que esta reversión humana deshizo (fase 9, D70). */
  @Prop({ type: String, default: null })
  revierteTurnoId: string | null;

  @Prop({ type: String, default: null })
  modelo: string | null;

  @Prop({ type: String, required: true })
  resumen: string;

  @Prop({ type: String, default: null })
  mensajeId: string | null;

  @Prop({ type: Object, default: null })
  solicitadoPor: PersonaEvento | null;

  @Prop({ type: Object, default: null })
  aprobadoPor: PersonaEvento | null;

  @Prop({ type: Date, required: true })
  ocurridoEn: Date;

  @Prop({ type: Date, required: true })
  creadoEn: Date;
}

export type EventoDocument = HydratedDocument<Evento>;

export const EventoSchema = SchemaFactory.createForClass(Evento);

EventoSchema.index({ proyectoId: 1, creadoEn: -1, _id: -1 });
EventoSchema.index({ proyectoId: 1, sesionId: 1, secuencia: 1 }, { unique: true });
EventoSchema.index({ proyectoId: 1, entidades: 1, creadoEn: -1 });
EventoSchema.index({ proyectoId: 1, actorUsuarioId: 1, creadoEn: -1 });
EventoSchema.index({ proyectoId: 1, actorNombre: 1, creadoEn: -1 });
EventoSchema.index({ proyectoId: 1, actorTipo: 1, creadoEn: -1 });
EventoSchema.index({ proyectoId: 1, turnoId: 1 });
EventoSchema.index({ proyectoId: 1, revierteTurnoId: 1 });
