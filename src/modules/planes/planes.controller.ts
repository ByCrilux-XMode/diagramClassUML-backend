import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { nombreCompleto } from '../../common/nombre-usuario.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { CrearPlanDto, ListarPlanesDto } from './dto/planes.dto.js';
import { PlanesService } from './planes.service.js';

@Controller('proyectos')
export class PlanesController {
  constructor(
    private readonly planesService: PlanesService,
    private readonly proyectosService: ProyectosService,
  ) {}

  @Post(':id/planes')
  async crear(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearPlanDto,
  ) {
    // El acuerdo del proyecto lo fija quien puede editar el diagrama.
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    const plan = await this.planesService.crear(proyectoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
    return { plan };
  }

  @Get(':id/planes')
  async listar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Query() filtros: ListarPlanesDto,
  ) {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    const [planes, vigente] = await Promise.all([
      this.planesService.listar(proyectoId, filtros.limite),
      this.planesService.vigente(proyectoId),
    ]);
    return { planes, vigente };
  }

  @Get(':id/planes/:version')
  async buscar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('version', ParseIntPipe) version: number,
  ) {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    const plan = await this.planesService.buscarVersion(proyectoId, version);
    return { plan };
  }
}
