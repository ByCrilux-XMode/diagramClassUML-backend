import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { NotificacionesService } from './notificaciones.service.js';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  listar(@UsuarioActual() usuario: Usuario, @Query() paginado: PaginadoDto) {
    return this.notificacionesService.listar(usuario.usuarioId, paginado);
  }

  @Patch('leidas')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marcarTodasLeidas(@UsuarioActual() usuario: Usuario): Promise<void> {
    await this.notificacionesService.marcarTodasLeidas(usuario.usuarioId);
  }

  @Patch(':id/leida')
  marcarLeida(@UsuarioActual() usuario: Usuario, @Param('id', ParseIntPipe) id: number) {
    return this.notificacionesService.marcarLeida(usuario.usuarioId, id);
  }
}
