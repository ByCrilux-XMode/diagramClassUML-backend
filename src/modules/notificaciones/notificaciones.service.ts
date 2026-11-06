import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import {
  ContextoAccionProyecto,
  nombreCompleto,
  PLANTILLAS_ACCION_PROYECTO,
  TipoAccionProyecto,
} from './accion-proyecto.constantes.js';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { Notificacion } from './notificacion.entity.js';

export interface DatosAccionProyecto {
  versionId?: number;
  nombreVersion?: string;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion) private readonly repositorioNotificaciones: Repository<Notificacion>,
    @InjectRepository(Usuario) private readonly repositorioUsuarios: Repository<Usuario>,
    @InjectRepository(Colaborador) private readonly repositorioColaboradores: Repository<Colaborador>,
    private readonly firebaseAdminService: FirebaseAdminService,
  ) {}

  async notificarAccionProyecto(
    tipoAccion: TipoAccionProyecto,
    proyecto: Proyecto,
    actor: Usuario,
    datosAccion: DatosAccionProyecto = {},
  ): Promise<void> {
    try {
      await this.enviarNotificacion(tipoAccion, proyecto, actor, datosAccion);
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la notificación ${tipoAccion} del proyecto ${proyecto.proyectoId}: ${this.describirError(error)}`,
      );
    }
  }

  private async enviarNotificacion(
    tipoAccion: TipoAccionProyecto,
    proyecto: Proyecto,
    actor: Usuario,
    datosAccion: DatosAccionProyecto,
  ): Promise<void> {
    const destinatarios = await this.obtenerDestinatarios(proyecto, actor.usuarioId);
    if (destinatarios.length === 0) {
      return;
    }

    const contexto: ContextoAccionProyecto = { actor, proyecto, ...datosAccion };
    const plantilla = PLANTILLAS_ACCION_PROYECTO[tipoAccion](contexto);
    const datos = this.construirDatos(tipoAccion, proyecto, actor, datosAccion);

    const notificaciones = destinatarios.map((destinatario) =>
      this.repositorioNotificaciones.create({
        tipoAccion,
        titulo: plantilla.titulo,
        mensaje: plantilla.mensaje,
        datos,
        destinatario,
        actor,
        proyecto,
      }),
    );
    const guardadas = await this.repositorioNotificaciones.save(notificaciones);

    const envios = guardadas.map(async (notificacion, indice) => {
      const destinatario = destinatarios[indice];
      if (!destinatario.tokenFirebase) {
        return;
      }
      const enviada = await this.firebaseAdminService.enviarPush({
        token: destinatario.tokenFirebase,
        titulo: plantilla.titulo,
        mensaje: plantilla.mensaje,
        datos,
      });
      if (enviada) {
        await this.repositorioNotificaciones.update(notificacion.notificacionId, { enviada: true });
      }
    });
    await Promise.allSettled(envios);
    this.logger.log(
      `Acción ${tipoAccion} notificada a ${destinatarios.length} usuario(s) del proyecto ${proyecto.proyectoId}`,
    );
  }

  async listar(
    usuarioId: number,
    paginado: PaginadoDto,
  ): Promise<{ datos: Notificacion[]; total: number; noLeidas: number }> {
    const [datos, total] = await this.repositorioNotificaciones.findAndCount({
      where: { destinatario: { usuarioId } },
      relations: { actor: { persona: true } },
      order: { creadaEn: 'DESC' },
      skip: (paginado.pagina - 1) * paginado.limite,
      take: paginado.limite,
    });
    const noLeidas = await this.repositorioNotificaciones.count({
      where: { destinatario: { usuarioId }, leida: false },
    });
    return { datos, total, noLeidas };
  }

  async marcarLeida(usuarioId: number, notificacionId: number): Promise<Notificacion> {
    const notificacion = await this.repositorioNotificaciones.findOne({
      where: { notificacionId, destinatario: { usuarioId } },
    });
    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }
    if (!notificacion.leida) {
      notificacion.leida = true;
      await this.repositorioNotificaciones.save(notificacion);
    }
    return notificacion;
  }

  async marcarTodasLeidas(usuarioId: number): Promise<void> {
    const pendientes = await this.repositorioNotificaciones.find({
      where: { destinatario: { usuarioId }, leida: false },
      select: { notificacionId: true },
    });
    if (pendientes.length === 0) {
      return;
    }
    await this.repositorioNotificaciones.update(
      pendientes.map((notificacion) => notificacion.notificacionId),
      { leida: true },
    );
  }

  private async obtenerDestinatarios(proyecto: Proyecto, actorId: number): Promise<Usuario[]> {
    const colaboradores = await this.repositorioColaboradores.find({
      where: { proyectoId: proyecto.proyectoId },
    });
    const idsDestinatarios = new Set<number>([
      proyecto.creador.usuarioId,
      ...colaboradores.map((colaborador) => colaborador.usuarioId),
    ]);
    idsDestinatarios.delete(actorId);
    if (idsDestinatarios.size === 0) {
      return [];
    }
    return this.repositorioUsuarios.find({ where: { usuarioId: In([...idsDestinatarios]) } });
  }

  private construirDatos(
    tipoAccion: TipoAccionProyecto,
    proyecto: Proyecto,
    actor: Usuario,
    datosAccion: DatosAccionProyecto,
  ): Record<string, string> {
    const datos: Record<string, string> = {
      tipoAccion,
      proyectoId: String(proyecto.proyectoId),
      nombreProyecto: proyecto.nombre,
      actorId: String(actor.usuarioId),
      actorUsername: actor.username,
      actorNombre: nombreCompleto(actor),
    };
    if (datosAccion.versionId !== undefined) {
      datos.versionId = String(datosAccion.versionId);
    }
    if (datosAccion.nombreVersion) {
      datos.nombreVersion = datosAccion.nombreVersion;
    }
    return datos;
  }

  private describirError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
