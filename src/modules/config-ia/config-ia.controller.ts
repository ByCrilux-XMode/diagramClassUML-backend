import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { nombreCompleto } from '../../common/nombre-usuario.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { ConfigIaService } from './config-ia.service.js';
import { ActualizarConfigIaDto } from './dto/config-ia.dto.js';

@Controller('proyectos/:id/config-ia')
export class ConfigIaController {
  constructor(
    private readonly configIaService: ConfigIaService,
    private readonly proyectosService: ProyectosService,
  ) {}

  @Get()
  async obtener(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
  ) {
    // Cualquier colaborador, incluido LECTOR, ve la configuración vigente.
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    return { config: await this.configIaService.obtener(proyectoId) };
  }

  @Patch()
  async actualizar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: ActualizarConfigIaDto,
  ) {
    // La preferencia del proyecto la fija solo quien lo creó (D58).
    await this.proyectosService.verificarCreadorProyecto(usuario.usuarioId, proyectoId);
    return {
      config: await this.configIaService.actualizar(proyectoId, dto, {
        usuarioId: usuario.usuarioId,
        nombre: nombreCompleto(usuario),
      }),
    };
  }
}
