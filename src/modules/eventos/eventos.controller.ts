import { Controller, Get, Param, ParseIntPipe, Post, Body, Query } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { nombreCompleto } from '../../common/nombre-usuario.js';
import { ListarEventosDto, RegistrarEventosDto } from './dto/eventos.dto.js';
import { EventosService } from './eventos.service.js';

@Controller('proyectos')
export class EventosController {
  constructor(
    private readonly eventosService: EventosService,
    private readonly proyectosService: ProyectosService,
  ) {}

  @Post(':id/eventos')
  async registrar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: RegistrarEventosDto,
  ) {
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    return this.eventosService.registrarLote(proyectoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
  }

  @Get(':id/eventos')
  async listar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Query() filtros: ListarEventosDto,
  ) {
    // Cualquier colaborador puede leer la bitácora, incluido un LECTOR.
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    return this.eventosService.listar(proyectoId, filtros);
  }

  /**
   * Elegibilidad de la reversión (fase 9, D69). Solo CREADOR y EDITOR: un
   * LECTOR no puede deshacer ediciones y un ajeno recibe 403.
   */
  @Get(':id/eventos/ultimo-turno-ia')
  async ultimoTurnoIA(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
  ) {
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    return this.eventosService.ultimoTurnoIA(proyectoId);
  }
}
