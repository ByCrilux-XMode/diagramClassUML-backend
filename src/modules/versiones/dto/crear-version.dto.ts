import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;
}
