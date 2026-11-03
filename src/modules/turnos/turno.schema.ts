import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type EstadoTurno = 'corriendo' | 'listo' | 'error';
export type ModoTurno = 'plan' | 'build';

export interface PersonaTurno {
  usuarioId: number;
  nombre: string;
}

/**
 * Un turno de IA en curso por proyecto. `activo` es el candado: el índice único
 * parcial sobre `{ proyectoId, activo }` con `activo: true` garantiza que dos
 * navegadores no corran dos loops a la vez (D42).
 */
@Schema({ collection: 'turnos_ia', timestamps: false })
export class TurnoIA {
  @Prop({ type: Number, required: true, index: true })
  proyectoId: number;

  @Prop({ type: Boolean, required: true })
  activo: boolean;

  @Prop({ type: String, required: true, enum: ['corriendo', 'listo', 'error'] })
  estado: EstadoTurno;

  @Prop({ type: String, required: true, enum: ['plan', 'build'] })
  modo: ModoTurno;

  @Prop({ type: String, default: null })
  salaId: string | null;

  @Prop({ type: String, default: null })
  mensajeId: string | null;

  @Prop({ type: String, default: null })
  proveedor: string | null;

  @Prop({ type: String, default: null })
  modelo: string | null;

  @Prop({ type: Object, required: true })
  iniciadoPor: PersonaTurno;

  @Prop({ type: Date, required: true })
  iniciadoEn: Date;

  @Prop({ type: Date, default: null })
  terminadoEn: Date | null;

  /** true cuando el turno se liberó por arriendo vencido, no por su navegador. */
  @Prop({ type: Boolean, default: false })
  arriendo: boolean;

  @Prop({ type: String, default: null })
  motivo: string | null;
}

export type TurnoIADocument = HydratedDocument<TurnoIA>;
export const TurnoIASchema = SchemaFactory.createForClass(TurnoIA);

// Un solo turno activo por proyecto. El partialFilterExpression hace que solo
// los documentos con activo: true compitan por la unicidad.
TurnoIASchema.index(
  { proyectoId: 1, activo: 1 },
  { unique: true, partialFilterExpression: { activo: true } },
);
TurnoIASchema.index({ proyectoId: 1, iniciadoEn: -1 });
