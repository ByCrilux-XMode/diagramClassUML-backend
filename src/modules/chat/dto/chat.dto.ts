import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PersonaMensajeDto {
  @IsInt()
  usuarioId: number;

  @IsString()
  @MaxLength(120)
  nombre: string;
}

export class EnviarMensajeDto {
  @IsOptional()
  @IsIn(['humano', 'ia'])
  autorTipo: 'humano' | 'ia' = 'humano';

  @IsString()
  @MaxLength(4000)
  contenido: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  claveIdempotencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  turnoId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonaMensajeDto)
  solicitadoPor?: PersonaMensajeDto;
}

export class EnviarSucesoDto {
  @IsIn(['propuesta.aplicada', 'propuesta.descartada'])
  tipo: 'propuesta.aplicada' | 'propuesta.descartada';

  @IsString()
  @MaxLength(80)
  turnoId: string;

  @IsInt()
  @Min(0)
  cambios: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  errores?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  claveIdempotencia?: string;
}

export class ActualizarResumenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  texto: string;

  /** Último mensaje cubierto por el resumen; debe pertenecer a la sala. */
  @IsString()
  @MaxLength(80)
  hastaMensajeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelo?: string;
}

export class ListarMensajesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite: number = 50;

  /** Devuelve los últimos mensajes de texto en orden cronológico, para el contexto del modelo. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  contexto?: boolean;
}
