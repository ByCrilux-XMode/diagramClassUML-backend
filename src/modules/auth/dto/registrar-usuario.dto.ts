import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegistrarUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  tokenFirebase?: string;
}