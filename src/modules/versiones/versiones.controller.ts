import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { ActualizarVersionDto } from './dto/actualizar-version.dto.js';
import { CrearVersionDto } from './dto/crear-version.dto.js';
import { VersionesService } from './versiones.service.js';

@Controller('proyectos/:proyectoId/versiones')
export class VersionesController {
  constructor(private readonly versionesService: VersionesService) {}

  @Get()
  listar(@UsuarioActual() usuario: Usuario, @Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.versionesService.listar(usuario.usuarioId, proyectoId);
  }

  @Post()
  crear(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearVersionDto,
  ) {
    return this.versionesService.crear(usuario.usuarioId, proyectoId, dto);
  }

  @Post(':versionId/restaurar')
  @HttpCode(HttpStatus.OK)
  restaurar(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.versionesService.restaurar(usuario.usuarioId, proyectoId, versionId);
  }

  @Patch(':versionId')
  actualizar(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() dto: ActualizarVersionDto,
  ) {
    return this.versionesService.actualizar(usuario.usuarioId, proyectoId, versionId, dto);
  }

  @Delete(':versionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(
    @UsuarioActual() usuario: Usuario,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ): Promise<void> {
    await this.versionesService.eliminar(usuario.usuarioId, proyectoId, versionId);
  }
}
