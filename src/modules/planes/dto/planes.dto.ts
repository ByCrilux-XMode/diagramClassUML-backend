import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CrearPlanDto {
  @IsString()
  @MaxLength(20000)
  contenido: string;

  /** Quién redactó el texto: la IA en modo plan, una persona si la pegó. */
  @IsIn(['humano', 'ia'])
  origen: 'humano' | 'ia';
}

export class ListarPlanesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite: number = 10;
}
