import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * Resumen rodante de la conversación grupal.
 *
 * `hastaMensajeId` y `hastaCreadoEn` identifican el último mensaje cubierto;
 * el PATCH condicional usa `hastaCreadoEn` para que un resumen viejo no pise
 * uno más nuevo. El resumen vive en Mongo porque es memoria del proyecto, no
 * del navegador que lo generó.
 */
export interface ResumenSala {
  texto: string;
  hastaMensajeId: string;
  hastaCreadoEn: Date;
  modelo: string | null;
  actualizadoEn: Date;
}

@Schema({ collection: 'salas', timestamps: false })
export class Sala {
  @Prop({ type: Number, required: true })
  proyectoId: number;

  @Prop({ type: String, required: true, enum: ['grupo'], default: 'grupo' })
  tipo: 'grupo';

  @Prop({ type: Date, required: true })
  creadaEn: Date;

  @Prop({ type: Object, default: null })
  resumen: ResumenSala | null;
}

export type SalaDocument = HydratedDocument<Sala>;

export const SalaSchema = SchemaFactory.createForClass(Sala);
SalaSchema.index({ proyectoId: 1 }, { unique: true });
