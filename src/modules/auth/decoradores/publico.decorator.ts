import { SetMetadata } from '@nestjs/common';

export const CLAVE_PUBLICA = 'es_publico';

export const EsPublico = (): MethodDecorator & ClassDecorator => SetMetadata(CLAVE_PUBLICA, true);