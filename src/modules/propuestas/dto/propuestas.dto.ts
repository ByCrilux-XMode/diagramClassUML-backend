import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const ESTADOS_PROPUESTA = [
  'pendiente',
  'aprobando',
  'aplicada',
  'error',
  'rechazada',
] as const;

export class PropuestaItemDto {
  /** Clave estable del tool-call: hace idempotente el reenvío del lote. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clavePropuesta: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  toolName: string;

  @IsObject()
  args: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Max(100)
  round: number;
}

export class CrearLotePropuestasDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  turnoId: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mensajeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PropuestaItemDto)
  propuestas: PropuestaItemDto[];
}

export class ListarPropuestasDto {
  @IsOptional()
  @IsIn(ESTADOS_PROPUESTA)
  estado?: (typeof ESTADOS_PROPUESTA)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 50;
}

export class ReportarResultadoDto {
  @IsIn(['aplicada', 'error'])
  estado: 'aplicada' | 'error';

  @IsInt()
  @Min(0)
  aplicadas: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  errores?: string[];
}
