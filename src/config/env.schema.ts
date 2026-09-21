import { Transform, plainToInstance } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export class Entorno {
  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => (value === undefined ? 3000 : Number(value)))
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DB_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => (value === undefined ? 5432 : Number(value)))
  DB_PORT: number = 5432;

  @IsString()
  @IsOptional()
  DB_USERNAME: string = 'postgres';

  @IsString()
  @IsOptional()
  DB_PASSWORD: string = '';

  @IsString()
  @IsOptional()
  DB_NAME: string = 'examen_sw1';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? false : value === 'true'))
  DB_SSL: boolean = false;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? false : value === 'true'))
  COOKIE_SECURE: boolean = false;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:5173';
}

export function validarEntorno(variables: Record<string, unknown>): Entorno {
  const instancia = plainToInstance(Entorno, variables);
  const errores = validateSync(instancia, { skipMissingProperties: false });
  if (errores.length > 0) {
    throw new Error(
      `Variables de entorno inválidas: ${errores
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }
  return instancia;
}