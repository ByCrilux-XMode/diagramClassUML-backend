import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { nombreCompleto } from '../../common/nombre-usuario.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import {
  CrearLotePropuestasDto,
  ListarPropuestasDto,
  ReportarResultadoDto,
} from './dto/propuestas.dto.js';
import { PropuestasService } from './propuestas.service.js';

@Controller('proyectos/:id/propuestas')
export class PropuestasController {
  constructor(
    private readonly propuestasService: PropuestasService,
    private readonly proyectosService: ProyectosService,
  ) {}

  @Post()
  async crear(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearLotePropuestasDto,
  ) {
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    // La autoría sale del token: el cuerpo no puede suplantar al solicitante.
    return this.propuestasService.crearLote(proyectoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
  }

  @Get()
  async listar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Query() filtros: ListarPropuestasDto,
  ) {
    // Cualquier colaborador lee las propuestas, incluido un LECTOR.
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    return this.propuestasService.listar(proyectoId, filtros);
  }

  @Post(':turnoId/aprobar')
  async aprobar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('turnoId') turnoId: string,
  ) {
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    return this.propuestasService.aprobar(proyectoId, turnoId, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
  }

  @Post(':turnoId/rechazar')
  async rechazar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('turnoId') turnoId: string,
  ) {
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    return this.propuestasService.rechazar(proyectoId, turnoId, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
  }

  @Patch(':turnoId/resultado')
  async reportarResultado(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('turnoId') turnoId: string,
    @Body() dto: ReportarResultadoDto,
  ) {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    return this.propuestasService.reportarResultado(proyectoId, turnoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
  }
}
