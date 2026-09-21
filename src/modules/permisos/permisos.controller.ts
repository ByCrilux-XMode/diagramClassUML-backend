import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CrearPermisoDto } from './dto/crear-permiso.dto.js';
import { PermisosService } from './permisos.service.js';

@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get()
  listar() {
    return this.permisosService.listar();
  }

  @Post()
  crear(@Body() dto: CrearPermisoDto) {
    return this.permisosService.crear(dto.nombre);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.permisosService.eliminar(id);
  }
}