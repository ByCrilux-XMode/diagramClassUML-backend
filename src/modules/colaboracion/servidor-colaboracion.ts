import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { COOKIE_TOKEN } from '../auth/cookie.constantes.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { RUTA_COLABORACION } from './colaboracion.constantes.js';

interface CargaJwt {
  sub: number;
  username: string;
}

type ResultadoProyecto = { ok: true; proyectoId: number } | { ok: false; error: string };

@Injectable()
export class ServidorColaboracion implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServidorColaboracion.name);
  private servidorWs: WebSocketServer | null = null;
  private servidorHttp: Server | null = null;
  private oyenteUpgrade: ((peticion: IncomingMessage, socket: Duplex, cabeza: Buffer) => void) | null = null;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly proyectosService: ProyectosService,
  ) {}

  onModuleInit(): void {
    const servidorHttp = this.httpAdapterHost.httpAdapter.getHttpServer() as Server;
    this.servidorHttp = servidorHttp;
    this.servidorWs = new WebSocketServer({ noServer: true });
    this.oyenteUpgrade = (peticion, socket, cabeza) => {
      void this.manejarUpgrade(peticion, socket, cabeza);
    };
    servidorHttp.on('upgrade', this.oyenteUpgrade);
    this.logger.log(`Colaboración en tiempo real disponible en ${RUTA_COLABORACION}`);
  }

  onModuleDestroy(): void {
    if (this.servidorHttp && this.oyenteUpgrade) {
      this.servidorHttp.removeListener('upgrade', this.oyenteUpgrade);
    }
    this.servidorWs?.close();
    this.servidorWs = null;
    this.servidorHttp = null;
    this.oyenteUpgrade = null;
  }

  private async manejarUpgrade(peticion: IncomingMessage, socket: Duplex, cabeza: Buffer): Promise<void> {
    const url = new URL(peticion.url ?? '', 'http://localhost');
    if (url.pathname !== RUTA_COLABORACION) {
      return;
    }

    const resultadoProyecto = this.leerProyecto(url);
    if (!resultadoProyecto.ok) {
      this.rechazar(socket, 400, resultadoProyecto.error);
      return;
    }

    const token = url.searchParams.get('token') ?? this.extraerCookie(peticion, COOKIE_TOKEN);
    if (!token) {
      this.rechazar(socket, 401, 'Token de autenticación requerido');
      return;
    }

    let carga: CargaJwt;
    try {
      carga = await this.jwtService.verifyAsync<CargaJwt>(token);
    } catch {
      this.rechazar(socket, 401, 'Token inválido o expirado');
      return;
    }

    try {
      await this.usuariosService.buscarPorId(carga.sub);
    } catch {
      this.rechazar(socket, 401, 'Usuario no válido');
      return;
    }

    try {
      const rol = await this.proyectosService.verificarMiembro(carga.sub, resultadoProyecto.proyectoId);
      if (rol === null) {
        this.rechazar(socket, 403, 'No eres miembro del proyecto');
        return;
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.rechazar(socket, 404, 'Proyecto no encontrado');
      } else {
        this.rechazar(socket, 403, 'No tienes acceso al proyecto');
      }
      return;
    }

    this.servidorWs?.handleUpgrade(peticion, socket, cabeza, (conexion) => {
      setupWSConnection(conexion, peticion, { docName: String(resultadoProyecto.proyectoId) });
    });
  }

  private leerProyecto(url: URL): ResultadoProyecto {
    const valor = url.searchParams.get('proyectoId');
    const proyectoId = valor === null ? Number.NaN : Number(valor);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return { ok: false, error: 'Parámetro proyectoId inválido' };
    }
    return { ok: true, proyectoId };
  }

  private extraerCookie(peticion: IncomingMessage, nombre: string): string | null {
    const cookie = peticion.headers.cookie;
    if (!cookie) return null;
    for (const parte of cookie.split(';')) {
      const [clave, ...resto] = parte.trim().split('=');
      if (clave === nombre) return resto.join('=');
    }
    return null;
  }

  private rechazar(socket: Duplex, estado: number, mensaje: string): void {
    socket.write(
      `HTTP/1.1 ${estado} ${this.razonEstado(estado)}\r\n` +
        `Connection: close\r\n` +
        `Content-Type: text/plain; charset=utf-8\r\n` +
        `Content-Length: ${Buffer.byteLength(mensaje)}\r\n\r\n` +
        mensaje,
    );
    socket.destroy();
  }

  private razonEstado(estado: number): string {
    const razones: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
    };
    return razones[estado] ?? 'Error';
  }
}