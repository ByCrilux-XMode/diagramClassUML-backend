import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../usuarios/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto.js';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto.js';

const COSTO_BCRYPT = 10;

export interface RespuestaAutenticacion {
  tokenAcceso: string;
  usuario: Usuario;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async registrarUsuario(dto: RegistrarUsuarioDto): Promise<RespuestaAutenticacion> {
    const contrasena = await bcrypt.hash(dto.password, COSTO_BCRYPT);
    const usuario = await this.usuariosService.crearUsuarioConPersona({
      username: dto.username,
      contrasena,
      nombre: dto.nombre,
      apellido: dto.apellido,
    });
    const perfil = await this.usuariosService.buscarPorId(usuario.usuarioId);
    return { tokenAcceso: await this.firmarToken(perfil), usuario: perfil };
  }

  async iniciarSesion(dto: IniciarSesionDto): Promise<RespuestaAutenticacion> {
    const usuario = await this.usuariosService.buscarPorUsername(dto.username);
    if (!usuario || !(await bcrypt.compare(dto.password, usuario.contrasena))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const perfil = await this.usuariosService.buscarPorId(usuario.usuarioId);
    return { tokenAcceso: await this.firmarToken(perfil), usuario: perfil };
  }

  private firmarToken(usuario: Usuario): Promise<string> {
    return this.jwtService.signAsync({ sub: usuario.usuarioId, username: usuario.username });
  }
}