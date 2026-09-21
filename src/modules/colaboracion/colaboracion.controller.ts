import { Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { ColaboracionService } from './colaboracion.service.js';

@Controller('proyectos')
export class ColaboracionController {
  constructor(private readonly colaboracionService: ColaboracionService) {}

  @Post(':proyectoId/guardar-colaboracion')
  @HttpCode(HttpStatus.OK)
  guardar(@UsuarioActual() usuario: Usuario, @Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.colaboracionService.guardar(usuario.usuarioId, proyectoId);
  }
}