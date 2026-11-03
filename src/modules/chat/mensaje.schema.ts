import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type TipoMensaje = 'texto' | 'suceso';
export type AutorTipo = 'humano' | 'ia';
export type TipoSuceso = 'propuesta.aplicada' | 'propuesta.descartada';

export interface PersonaMensaje {
  usuarioId: number;
  nombre: string;
}

export interface SucesoMensaje {
  tipo: TipoSuceso;
  turnoId: string;
  cambios: number;
  errores: string[];
  actor: PersonaMensaje;
}

/**
 * Mensaje append-only de la sala grupal. `suceso` es un hecho estructurado:
 * el texto visible se deriva al renderizar, no se guarda congelado.
 */
@Schema({ collection: 'mensajes', timestamps: false })
export class Mensaje {
  @Prop({ type: String, required: true })
  salaId: string;

  @Prop({ type: Number, required: true })
  proyectoId: number;

  @Prop({ type: String, required: true, enum: ['texto', 'suceso'] })
  tipo: TipoMensaje;

  @Prop({ type: String, required: true, enum: ['humano', 'ia'] })
  autorTipo: AutorTipo;

  @Prop({ type: Number, default: null })
  autorUsuarioId: number | null;

  @Prop({ type: String, required: true })
  autorNombre: string;

  @Prop({ type: String, default: null })
  modelo: string | null;

  @Prop({ type: String, default: null })
  contenido: string | null;

  @Prop({ type: Object, default: null })
  suceso: SucesoMensaje | null;

  @Prop({ type: String, default: null })
  turnoId: string | null;

  @Prop({ type: Object, default: null })
  solicitadoPor: PersonaMensaje | null;

  @Prop({ type: String, default: null })
  claveIdempotencia: string | null;

  @Prop({ type: Date, required: true })
  creadoEn: Date;
}

export type MensajeDocument = HydratedDocument<Mensaje>;
export const MensajeSchema = SchemaFactory.createForClass(Mensaje);

MensajeSchema.index({ salaId: 1, creadoEn: -1, _id: -1 });
MensajeSchema.index({ salaId: 1, turnoId: 1 });
MensajeSchema.index(
  { salaId: 1, claveIdempotencia: 1 },
  { unique: true, partialFilterExpression: { claveIdempotencia: { $type: 'string' } } },
);
