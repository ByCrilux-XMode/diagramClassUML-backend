import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { Usuario } from '../usuarios/usuario.entity.js';
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