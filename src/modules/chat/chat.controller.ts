import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { nombreCompleto } from '../../common/nombre-usuario.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { ChatService } from './chat.service.js';
import { ChatStreamService } from './chat-stream.service.js';
import { EnviarMensajeDto, EnviarSucesoDto, ActualizarResumenDto, ListarMensajesDto } from './dto/chat.dto.js';

@Controller('proyectos/:id/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly streamService: ChatStreamService,
    private readonly proyectosService: ProyectosService,
  ) {}

  @Get('sala')
  async sala(@UsuarioActual() usuario: Usuario, @Param('id', ParseIntPipe) proyectoId: number) {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    return this.chatService.obtenerOCrearSala(proyectoId);
  }

  @Get('mensajes')
  async mensajes(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Query() filtros: ListarMensajesDto,
  ) {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    return this.chatService.listar(proyectoId, filtros);
  }

  @Post('mensajes')
  async enviar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: EnviarMensajeDto,
  ) {
    const rol = await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    const puedeEditar = rol === 'CREADOR' || rol === 'EDITOR';
    return this.chatService.enviarTexto(
      proyectoId,
      dto,
      { usuarioId: usuario.usuarioId, nombre: nombreCompleto(usuario) },
      puedeEditar,
    );
  }

  @Post('sucesos')
  async suceso(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: EnviarSucesoDto,
  ) {
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    return this.chatService.enviarSuceso(proyectoId, dto, {
      usuarioId: usuario.usuarioId,
      nombre: nombreCompleto(usuario),
    });
  }

  @Patch('sala/resumen')
  async actualizarResumen(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
    @Body() dto: ActualizarResumenDto,
  ) {
    // El resumen es un acuerdo del grupo: lo escribe quien puede editar.
    await this.proyectosService.verificarPermisoEscritura(usuario.usuarioId, proyectoId);
    return this.chatService.actualizarResumen(proyectoId, dto);
  }

  @Sse('stream')
  async stream(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseIntPipe) proyectoId: number,
  ): Promise<Observable<MessageEvent>> {
    await this.proyectosService.verificarPermisoLectura(usuario.usuarioId, proyectoId);
    // Nest solo serializa el campo `data` del MessageEvent: sin envolver el
    // evento, el navegador recibe únicamente el `id` y ningún mensaje.
    return this.streamService.suscribir(proyectoId).pipe(
      map((evento): MessageEvent => ({ data: evento })),
    );
  }
}
