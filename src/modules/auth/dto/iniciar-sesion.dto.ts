import { IsNotEmpty, IsString } from 'class-validator';

export class IniciarSesionDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}