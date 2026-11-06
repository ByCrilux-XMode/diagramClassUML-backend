import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { ActualizarTokenFirebaseDto } from './dto/actualizar-token-firebase.dto.js';
import { Usuario } from './usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly proyectosService: ProyectosService,
  ) {}

  @Get()
  listar(@Query() paginado: PaginadoDto) {
    return this.usuariosService.listar(paginado);
  }

  @Get('me')
  verPerfil(@UsuarioActual() usuario: Usuario) {
    return this.usuariosService.buscarPorId(usuario.usuarioId);
  }

  @Get('me/proyectos')
  misProyectos(@UsuarioActual() usuario: Usuario, @Query() paginado: PaginadoDto) {
    return this.proyectosService.proyectosPorUsuario(usuario.usuarioId, paginado);
  }

  @Put('me/token-firebase')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrarTokenFirebase(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: ActualizarTokenFirebaseDto,
  ): Promise<void> {
    await this.usuariosService.actualizarTokenFirebase(usuario.usuarioId, dto.tokenFirebase);
  }

  @Delete('me/token-firebase')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarTokenFirebase(@UsuarioActual() usuario: Usuario): Promise<void> {
    await this.usuariosService.eliminarTokenFirebase(usuario.usuarioId);
  }

  @Get('username/:username')
  async obtenerPorUsername(@Param('username') username: string): Promise<Usuario> {
    const usuario = await this.usuariosService.buscarPorUsername(username);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return usuario;
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.buscarPorId(id);
  }
}