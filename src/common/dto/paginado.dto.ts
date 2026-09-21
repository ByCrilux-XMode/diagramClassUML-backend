import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginadoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pagina: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limite: number = 10;
}