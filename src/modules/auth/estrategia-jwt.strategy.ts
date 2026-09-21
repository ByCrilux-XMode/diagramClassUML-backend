import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { Entorno } from '../../config/env.schema.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { COOKIE_TOKEN } from './cookie.constantes.js';

interface CargaJwt {
  sub: number;
  username: string;
}

@Injectable()
export class EstrategiaJwt extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<Entorno, true>,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: (peticion: Request) => peticion.cookies?.[COOKIE_TOKEN] ?? null,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(carga: CargaJwt): Promise<Usuario> {
    const usuario = await this.usuariosService.buscarPorId(carga.sub);
    if (!usuario) {
      throw new UnauthorizedException('Usuario no válido');
    }
    return usuario;
  }
}