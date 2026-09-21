import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearPermisoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;
}