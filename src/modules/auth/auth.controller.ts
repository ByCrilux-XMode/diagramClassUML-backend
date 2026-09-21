import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Entorno } from '../../config/env.schema.js';
import { AuthService } from './auth.service.js';
import { calcularMaxAgeMs, eliminarCookie, establecerCookie } from './cookie.constantes.js';
import { EsPublico } from './decoradores/publico.decorator.js';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto.js';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<Entorno, true>,
  ) {}

  @EsPublico()
  @Post('registrarse')
  async registrarse(@Body() dto: RegistrarUsuarioDto, @Res({ passthrough: true }) respuesta: Response) {
    const { tokenAcceso, usuario } = await this.authService.registrarUsuario(dto);
    this.enviarCookie(respuesta, tokenAcceso);
    return { usuario };
  }

  @EsPublico()
  @Post('iniciar-sesion')
  @HttpCode(HttpStatus.OK)
  async iniciarSesion(@Body() dto: IniciarSesionDto, @Res({ passthrough: true }) respuesta: Response) {
    const { tokenAcceso, usuario } = await this.authService.iniciarSesion(dto);
    this.enviarCookie(respuesta, tokenAcceso);
    return { usuario };
  }

  @EsPublico()
  @Post('cerrar-sesion')
  @HttpCode(HttpStatus.NO_CONTENT)
  cerrarSesion(@Res({ passthrough: true }) respuesta: Response): void {
    eliminarCookie(respuesta);
  }

  private enviarCookie(respuesta: Response, tokenAcceso: string): void {
    const esSeguro = this.configService.get('COOKIE_SECURE') ?? false;
    const maxAge = calcularMaxAgeMs(this.configService.getOrThrow('JWT_EXPIRES_IN'));
    establecerCookie(respuesta, tokenAcceso, esSeguro, maxAge);
  }
}