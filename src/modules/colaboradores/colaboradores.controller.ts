import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { ColaboradoresService } from './colaboradores.service.js';
import { ActualizarPermisoColaboradorDto } from './dto/actualizar-permiso-colaborador.dto.js';
import { AsignarColaboradorDto } from './dto/asignar-colaborador.dto.js';

@Controller('proyectos/:proyectoId/colaboradores')
export class ColaboradoresController {
  constructor(private readonly colaboradoresService: ColaboradoresService) {}

  @Get()
  listar(@UsuarioActual() usuario: Usuario, @Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.colaboradoresService.listarDelProyecto(usuario.usuarioId, proyectoId);
  }

  @Post()
  asignar(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: AsignarColaboradorDto,
  ) {
    return this.colaboradoresService.asignar(usuario.usuarioId, proyectoId, dto);
  }

  @Patch(':usuarioId')
  actualizarPermiso(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('usuarioId', ParseIntPipe) colaboradorUsuarioId: number,
    @Body() dto: ActualizarPermisoColaboradorDto,
  ) {
    return this.colaboradoresService.actualizarPermiso(
      usuario.usuarioId,
      proyectoId,
      colaboradorUsuarioId,
      dto.permisoId,
    );
  }

  @Delete(':usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('usuarioId', ParseIntPipe) colaboradorUsuarioId: number,
  ): Promise<void> {
    await this.colaboradoresService.remover(usuario.usuarioId, proyectoId, colaboradorUsuarioId);
  }
}