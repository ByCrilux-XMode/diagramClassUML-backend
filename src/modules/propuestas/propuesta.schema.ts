import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type EstadoPropuesta = 'pendiente' | 'aprobando' | 'aplicada' | 'error' | 'rechazada';

export interface PersonaPropuesta {
  usuarioId: number;
  nombre: string;
}

export interface ResultadoPropuesta {
  aplicadas: number;
  errores: string[];
}

/**
 * Una herramienta propuesta por la IA. La unidad de almacenamiento es la
 * herramienta; la unidad de resolución es el turno (D26). Sin TTL: una
 * propuesta pendiente vive hasta que una persona la resuelve (D35).
 */
@Schema({ collection: 'propuestas', timestamps: false })
export class Propuesta {
  @Prop({ type: Number, required: true })
  proyectoId: number;

  @Prop({ type: String, required: true })
  turnoId: string;

  @Prop({ type: String, default: null })
  mensajeId: string | null;

  @Prop({ type: String, required: true })
  clavePropuesta: string;

  @Prop({ type: String, required: true })
  toolName: string;

  @Prop({ type: Object, required: true })
  args: Record<string, unknown>;

  @Prop({ type: Number, required: true })
  round: number;

  @Prop({
    type: String,
    required: true,
    enum: ['pendiente', 'aprobando', 'aplicada', 'error', 'rechazada'],
    default: 'pendiente',
  })
  estado: EstadoPropuesta;

  @Prop({ type: Object, required: true })
  solicitadoPor: PersonaPropuesta;

  @Prop({ type: String, default: null })
  modelo: string | null;

  @Prop({ type: Object, default: null })
  aprobadoPor: PersonaPropuesta | null;

  @Prop({ type: Date, default: null })
  reclamadaEn: Date | null;

  @Prop({ type: Date, default: null })
  resueltaEn: Date | null;

  @Prop({ type: Object, default: null })
  resultado: ResultadoPropuesta | null;

  @Prop({ type: Date, required: true })
  creadoEn: Date;
}

export type PropuestaDocument = HydratedDocument<Propuesta>;
export const PropuestaSchema = SchemaFactory.createForClass(Propuesta);

// Un reintento del navegador no duplica el lote (D32).
PropuestaSchema.index({ proyectoId: 1, turnoId: 1, clavePropuesta: 1 }, { unique: true });
// Panel de pendientes, de la más antigua a la más nueva.
PropuestaSchema.index({ proyectoId: 1, estado: 1, creadoEn: -1 });
// Claim por turno.
PropuestaSchema.index({ proyectoId: 1, turnoId: 1, estado: 1 });
