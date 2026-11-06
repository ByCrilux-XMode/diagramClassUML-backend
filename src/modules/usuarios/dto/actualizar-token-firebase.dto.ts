import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ActualizarTokenFirebaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  tokenFirebase: string;
}
