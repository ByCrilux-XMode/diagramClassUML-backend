import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReclamarTurnoDto {
  /** El modo declara si el turno es de edición: el servidor valida el rol. */
  @IsIn(['plan', 'build'])
  modo: 'plan' | 'build';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  salaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mensajeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  proveedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelo?: string;
}

export class CerrarTurnoDto {
  @IsIn(['listo', 'error'])
  estado: 'listo' | 'error';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  /** D62: el turno se cierra con el proveedor que respondió, no el del claim. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  proveedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelo?: string;
}
