import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PROVEEDORES_CONFIG } from '../config-ia.schema.js';

export class TramoConfigDto {
  @IsIn(PROVEEDORES_CONFIG)
  proveedor: (typeof PROVEEDORES_CONFIG)[number];

  /** Opcional: si falta o viene vacío, se usa el modelo del proveedor. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelo?: string;
}

export class CadenasConfigDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => TramoConfigDto)
  edicion?: TramoConfigDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => TramoConfigDto)
  consulta?: TramoConfigDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => TramoConfigDto)
  resumen?: TramoConfigDto[];
}

/**
 * El `ValidationPipe` global usa `whitelist + forbidNonWhitelisted`: cualquier
 * campo fuera de esta lista (`apiKey`, `token`, `secret`, …) se rechaza con 400
 * antes de llegar al servicio (D58).
 */
export class ActualizarConfigIaDto {
  @IsOptional()
  @IsIn(PROVEEDORES_CONFIG)
  proveedor?: (typeof PROVEEDORES_CONFIG)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CadenasConfigDto)
  cadenas?: CadenasConfigDto;
}
