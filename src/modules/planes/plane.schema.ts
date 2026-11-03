import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type OrigenPlan = 'humano' | 'ia';

/**
 * Acuerdo vigente del proyecto, versionado y append-only: un plan no se
 * reescribe, se sustituye con una versión nueva (D40).
 */
@Schema({ collection: 'planes', timestamps: false })
export class Plane {
  @Prop({ type: Number, required: true, index: true })
  proyectoId: number;

  @Prop({ type: Number, required: true })
  version: number;

  @Prop({ type: String, required: true })
  contenido: string;

  @Prop({ type: Number, required: true })
  autorUsuarioId: number;

  @Prop({ type: String, required: true })
  autorNombre: string;

  @Prop({ type: String, required: true, enum: ['humano', 'ia'] })
  origen: OrigenPlan;

  /** Versión que esta sustituye, o `null` si es la primera. */
  @Prop({ type: Number, default: null })
  sustituyeA: number | null;

  @Prop({ type: Date, required: true })
  creadoEn: Date;
}

export type PlaneDocument = HydratedDocument<Plane>;
export const PlaneSchema = SchemaFactory.createForClass(Plane);

// La unicidad cierra la carrera de dos guardados simultáneos (D40).
PlaneSchema.index({ proyectoId: 1, version: -1 }, { unique: true });
PlaneSchema.index({ proyectoId: 1, creadoEn: -1 });
