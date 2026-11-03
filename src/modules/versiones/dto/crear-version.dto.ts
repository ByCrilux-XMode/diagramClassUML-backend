import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}
