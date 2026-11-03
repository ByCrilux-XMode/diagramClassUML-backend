import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PersonaEventoDto {
  @IsInt()
  usuarioId: number;

  @IsString()
  @MaxLength(120)
  nombre: string;
}

export class CambioEventoDto {
  @IsIn(['crear', 'actualizar', 'eliminar'])
  accion: 'crear' | 'actualizar' | 'eliminar';

  @IsIn(['clase', 'relacion', 'atributo', 'metodo'])
  entidadTipo: 'clase' | 'relacion' | 'atributo' | 'metodo';

  @IsString()
  @MaxLength(200)
  entidadKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campo?: string;

  @IsOptional()
  @Allow()
  antes?: unknown;

  @IsOptional()
  @Allow()
  despues?: unknown;
}

export class EventoDto {
  @IsString()
  @MaxLength(80)
  sesionId: string;

  @IsInt()
  @Min(0)
  secuencia: number;

  @IsIn(['humano', 'ia', 'sistema'])
  actorTipo: 'humano' | 'ia' | 'sistema';

  @IsOptional()
  @IsInt()
  actorUsuarioId?: number | null;

  @IsString()
  @MaxLength(120)
  actorNombre: string;

  @IsOptional()
  @IsIn(['manual', 'ia', 'import', 'vision'])
  origen?: 'manual' | 'ia' | 'import' | 'vision';

  @IsString()
  @MaxLength(80)
  tipo: string;

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  entidades: string[];

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CambioEventoDto)
  cambios: CambioEventoDto[];

  @IsOptional()
  @IsString()
  turnoId?: string | null;

  /** Turno de IA que esta reversión deshace; solo lo envía una reversión. */
  @IsOptional()
  @IsString()
  revierteTurnoId?: string | null;

  @IsOptional()
  @IsString()
  modelo?: string | null;

  @IsString()
  @MaxLength(500)
  resumen: string;

  @IsOptional()
  @IsString()
  mensajeId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonaEventoDto)
  solicitadoPor?: PersonaEventoDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonaEventoDto)
  aprobadoPor?: PersonaEventoDto | null;

  @IsOptional()
  @IsDateString()
  ocurridoEn?: string;
}

export class RegistrarEventosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EventoDto)
  eventos: EventoDto[];
}

export class ListarEventosDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite: number = 50;

  @IsOptional()
  @IsIn(['humano', 'ia', 'sistema'])
  actorTipo?: 'humano' | 'ia' | 'sistema';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorUsuarioId?: number;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  entidad?: string;

  /** Inicio del rango por fecha de registro (ISO 8601). */
  @IsOptional()
  @IsDateString()
  desde?: string;

  /** Fin del rango por fecha de registro (ISO 8601). */
  @IsOptional()
  @IsDateString()
  hasta?: string;

  /** Nombre desnormalizado del actor, tal como quedó en la bitácora. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorNombre?: string;
}
