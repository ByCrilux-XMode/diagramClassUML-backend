import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Usuario } from '../../usuarios/usuario.entity.js';

export const UsuarioActual = createParamDecorator((datos: unknown, contexto: ExecutionContext): Usuario => {
  void datos;
  const peticion = contexto.switchToHttp().getRequest();
  return peticion.user as Usuario;
});