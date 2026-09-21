import { IsInt, IsPositive } from 'class-validator';

export class AsignarColaboradorDto {
  @IsInt()
  @IsPositive()
  usuarioId: number;

  @IsInt()
  @IsPositive()
  permisoId: number;
}