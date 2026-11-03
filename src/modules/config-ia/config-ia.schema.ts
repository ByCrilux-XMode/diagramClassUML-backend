import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Proveedores que pueden formar parte de una cadena (Ollama queda fuera, D61). */
export const PROVEEDORES_CONFIG = ['openrouter', 'hf-space', 'huggingface'] as const;
export type ProveedorConfig = (typeof PROVEEDORES_CONFIG)[number];

export type TareaConfig = 'edicion' | 'consulta' | 'resumen';

export interface TramoConfig {
  proveedor: ProveedorConfig;
  /** `null` usa el modelo por defecto del proveedor. */
  modelo: string | null;
}

export type CadenasConfig = Record<TareaConfig, TramoConfig[]>;

export interface PersonaConfig {
  usuarioId: number;
  nombre: string;
}

/**
 * Preferencia de proveedores del proyecto. Las API keys viven solo en `.env`:
 * este documento nunca guarda secretos (D58). Un proyecto sin documento usa
 * los defaults efectivos y lo informa con `porDefecto`.
 */
@Schema({ collection: 'config_ia', timestamps: false })
export class ConfigIa {
  @Prop({ type: Number, required: true })
  proyectoId: number;

  @Prop({ type: String, default: null })
  proveedor: ProveedorConfig | null;

  @Prop({ type: String, default: null })
  modelo: string | null;

  @Prop({ type: Object, required: true })
  cadenas: CadenasConfig;

  @Prop({ type: Object, default: null })
  actualizadoPor: PersonaConfig | null;

  @Prop({ type: Date, default: null })
  actualizadoEn: Date | null;
}

export type ConfigIaDocument = HydratedDocument<ConfigIa>;
export const ConfigIaSchema = SchemaFactory.createForClass(ConfigIa);

// Un solo documento por proyecto (D58).
ConfigIaSchema.index({ proyectoId: 1 }, { unique: true });
