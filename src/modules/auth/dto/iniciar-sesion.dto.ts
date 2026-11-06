import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class IniciarSesionDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  tokenFirebase?: string;
}