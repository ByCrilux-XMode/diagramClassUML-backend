import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { CrearVersionDto } from '../versiones/dto/crear-version.dto.js';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto.js';
import { CrearProyectoDto } from './dto/crear-proyecto.dto.js';
import { ProyectosService } from './proyectos.service.js';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CrearProyectoDto) {
    return this.proyectosService.crear(usuario.usuarioId, dto);
  }

  @Get()
  listar(@Query() paginado: PaginadoDto) {
    return this.proyectosService.listar(paginado);
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.buscarPorId(id);
  }

  @Get(':id/versiones')
  listarVersiones(@Param('id', ParseIntPipe) id: number, @Query() paginado: PaginadoDto) {
    return this.proyectosService.listarVersiones(id, paginado);
  }

  @Get(':id/versiones/:versionId')
  obtenerVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.proyectosService.obtenerVersion(id, versionId);
  }

  @Post(':id/versiones')
  crearVersion(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearVersionDto,
  ) {
    return this.proyectosService.crearVersion(usuario.usuarioId, id, dto);
  }

  @Post(':id/versiones/:versionId/restaurar')
  @HttpCode(HttpStatus.OK)
  restaurarVersion(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.proyectosService.restaurarVersion(usuario.usuarioId, id, versionId);
  }

  @Patch(':id')
  actualizar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProyectoDto,
  ) {
    return this.proyectosService.actualizar(usuario.usuarioId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@UsuarioActual() usuario: Usuario, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.proyectosService.eliminar(usuario.usuarioId, id);
  }
}