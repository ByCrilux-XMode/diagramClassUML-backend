import { IsInt, IsPositive } from 'class-validator';

export class ActualizarPermisoColaboradorDto {
  @IsInt()
  @IsPositive()
  permisoId: number;
}