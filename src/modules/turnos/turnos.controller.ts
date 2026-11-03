import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { nombreCompleto } from '../../common/nombre-usuario.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { CerrarTurnoDto, ReclamarTurnoDto } from './dto/turnos.dto.js';
import { TurnosService } from './turnos.service.js';

@Controller('proyectos')
export class TurnosController {
  constructor(
    private readonly turnosService: TurnosService,
    private readonly proyectosService: ProyectosService,
  ) {}

  // D66: la frecuencia se evalúa antes del permiso y del claim, de modo que un
  // 429 no crea ni deja activo ningún turno.
  @UseGuards(ThrottlerGuard)
  @Post(':id/turnos')
  async reclamar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: ReclamarTurnoDto,
  ) {
    // D41: el claim es donde el servidor valida el modo contra el rol. Un
    // LECTOR puede reclamar turnos de consulta, nunca de edición.
    if (dto.modo === 'build') {
      await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    } else {
      await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    }

    const { turno, arriendoLiberado } = await this.turnosService.reclamar(proyectoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
    return { turno, arriendoLiberado };
  }

  @Post(':id/turnos/:turnoId/estado')
  async cerrar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('turnoId') turnoId: string,
    @Body() dto: CerrarTurnoDto,
  ) {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    const turno = await this.turnosService.cerrar(proyectoId, turnoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
    return { turno };
  }
}
