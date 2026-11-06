import { ForbiddenException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { ChatService } from '../chat/chat.service.js';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { PersistenciaColaboracionService } from '../colaboracion/persistencia-colaboracion.service.js';
import { ConfigIaService } from '../config-ia/config-ia.service.js';
import { EventosService } from '../eventos/eventos.service.js';
import { nombreCompleto, TipoAccionProyecto } from '../notificaciones/accion-proyecto.constantes.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { PERMISO_EDITOR } from '../permisos/permiso.constantes.js';
import { PlanesService } from '../planes/planes.service.js';
import { PropuestasService } from '../propuestas/propuestas.service.js';
import { TurnosService } from '../turnos/turnos.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { CrearVersionDto } from '../versiones/dto/crear-version.dto.js';
import { VersionProyecto } from '../versiones/version-proyecto.entity.js';
import { VersionesService } from '../versiones/versiones.service.js';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto.js';
import { CrearProyectoDto } from './dto/crear-proyecto.dto.js';
import { ProyectoResumenDto, ROL_CREADOR } from './dto/proyecto-resumen.dto.js';
import { Proyecto } from './proyecto.entity.js';

@Injectable()
export class ProyectosService {
  private readonly logger = new Logger(ProyectosService.name);

  constructor(
    @InjectRepository(Proyecto) private readonly repositorioProyectos: Repository<Proyecto>,
    @InjectRepository(Colaborador) private readonly repositorioColaboradores: Repository<Colaborador>,
    private readonly usuariosService: UsuariosService,
    @Inject(forwardRef(() => EventosService)) private readonly eventosService: EventosService,
    @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
    @Inject(forwardRef(() => PlanesService)) private readonly planesService: PlanesService,
    @Inject(forwardRef(() => TurnosService)) private readonly turnosService: TurnosService,
    @Inject(forwardRef(() => PropuestasService)) private readonly propuestasService: PropuestasService,
    @Inject(forwardRef(() => ConfigIaService)) private readonly configIaService: ConfigIaService,
    private readonly versionesService: VersionesService,
    private readonly notificacionesService: NotificacionesService,
    private readonly persistenciaColaboracionService: PersistenciaColaboracionService,
  ) {}

  async crear(creadorId: number, dto: CrearProyectoDto): Promise<Proyecto> {
    const creador = await this.usuariosService.buscarPorId(creadorId);
    const proyecto = this.repositorioProyectos.create({
      nombre: dto.nombre,
      esquemaJson: dto.esquemaJson ?? null,
      creador,
    });
    await this.repositorioProyectos.save(proyecto);
    return this.buscarPorId(proyecto.proyectoId);
  }

  async listar(paginado: PaginadoDto): Promise<{ datos: Proyecto[]; total: number }> {
    const [datos, total] = await this.repositorioProyectos.findAndCount({
      relations: { creador: true },
      order: { proyectoId: 'ASC' },
      skip: (paginado.pagina - 1) * paginado.limite,
      take: paginado.limite,
    });
    return { datos, total };
  }

  async buscarPorId(proyectoId: number): Promise<Proyecto> {
    const proyecto = await this.repositorioProyectos.findOne({
      where: { proyectoId },
      relations: { creador: true },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    return proyecto;
  }

  async actualizar(usuarioId: number, proyectoId: number, dto: ActualizarProyectoDto): Promise<Proyecto> {
    const proyecto = await this.buscarPorId(proyectoId);
    await this.verificarAccesoEscritura(usuarioId, proyecto);
    const esquemaModificado = dto.esquemaJson !== undefined;
    if (dto.nombre !== undefined) proyecto.nombre = dto.nombre;
    if (dto.esquemaJson !== undefined) proyecto.esquemaJson = dto.esquemaJson;
    await this.repositorioProyectos.save(proyecto);
    if (esquemaModificado) {
      await this.registrarGuardado(usuarioId, proyectoId);
    }
    return this.buscarPorId(proyectoId);
  }

  async eliminar(usuarioId: number, proyectoId: number): Promise<void> {
    const proyecto = await this.buscarPorId(proyectoId);
    this.verificarCreador(proyecto, usuarioId);
    await this.repositorioProyectos.remove(proyecto);

    // Sin FK entre Neon y Atlas: si no se limpia aquí, los documentos quedan
    // huérfanos para siempre. La limpieza no revierte el borrado del proyecto.
    try {
      const [eventos, chat, planes, turnos, propuestas, config] = await Promise.all([
        this.eventosService.eliminarPorProyecto(proyectoId),
        this.chatService.eliminarPorProyecto(proyectoId),
        this.planesService.eliminarPorProyecto(proyectoId),
        this.turnosService.eliminarPorProyecto(proyectoId),
        this.propuestasService.eliminarPorProyecto(proyectoId),
        this.configIaService.eliminarPorProyecto(proyectoId),
      ]);
      this.logger.log(
        `Proyecto ${proyectoId} eliminado: ${eventos} evento(s), ${chat.mensajes} mensaje(s), ${chat.salas} sala(s), ${planes} plan(es), ${turnos} turno(s), ${propuestas} propuesta(s), ${config} config(s) de IA.`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `No se pudieron limpiar los datos de MongoDB del proyecto ${proyectoId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async registrarGuardado(usuarioId: number, proyectoId: number): Promise<void> {
    const proyecto = await this.buscarPorId(proyectoId);
    const actor = await this.usuariosService.buscarPorId(usuarioId);
    await this.versionesService.crear(proyecto, actor, {
      descripcionPredeterminada: `Guardado automático realizado por ${nombreCompleto(actor)}.`,
    });
    await this.notificacionesService.notificarAccionProyecto(
      TipoAccionProyecto.PROYECTO_GUARDADO,
      proyecto,
      actor,
    );
  }

  async crearVersion(usuarioId: number, proyectoId: number, dto: CrearVersionDto): Promise<VersionProyecto> {
    const proyecto = await this.verificarPermisoEscritura(usuarioId, proyectoId);
    const actor = await this.usuariosService.buscarPorId(usuarioId);
    return this.versionesService.crear(proyecto, actor, dto);
  }

  async restaurarVersion(usuarioId: number, proyectoId: number, versionId: number): Promise<Proyecto> {
    const proyecto = await this.verificarPermisoEscritura(usuarioId, proyectoId);
    const version = await this.versionesService.buscarPorId(proyectoId, versionId);
    await this.persistenciaColaboracionService.aplicarEsquema(proyectoId, version.esquemaJson);
    proyecto.esquemaJson = version.esquemaJson;
    await this.repositorioProyectos.save(proyecto);

    const proyectoActualizado = await this.buscarPorId(proyectoId);
    const actor = await this.usuariosService.buscarPorId(usuarioId);
    await this.versionesService.crear(proyectoActualizado, actor, {
      nombre: `Restauración de ${version.nombre}`,
      descripcion: `Restauración realizada por ${nombreCompleto(actor)}.`,
    });
    await this.notificacionesService.notificarAccionProyecto(
      TipoAccionProyecto.VERSION_RESTAURADA,
      proyectoActualizado,
      actor,
      { versionId: version.versionId, nombreVersion: version.nombre },
    );
    return proyectoActualizado;
  }

  listarVersiones(
    proyectoId: number,
    paginado: PaginadoDto,
  ): Promise<{ datos: VersionProyecto[]; total: number }> {
    return this.versionesService.listar(proyectoId, paginado);
  }

  obtenerVersion(proyectoId: number, versionId: number): Promise<VersionProyecto> {
    return this.versionesService.buscarPorId(proyectoId, versionId);
  }

  async eliminarVersion(usuarioId: number, proyectoId: number, versionId: number): Promise<void> {
    await this.verificarPermisoEscritura(usuarioId, proyectoId);
    await this.versionesService.eliminar(proyectoId, versionId);
  }

  async proyectosPorUsuario(
    usuarioId: number,
    paginado: PaginadoDto,
  ): Promise<{ datos: ProyectoResumenDto[]; total: number }> {
    const proyectosCreados = await this.repositorioProyectos.find({
      where: { creador: { usuarioId } },
      order: { proyectoId: 'ASC' },
    });
    const colaboraciones = await this.repositorioColaboradores.find({
      where: { usuarioId },
      relations: { proyecto: true, permiso: true },
    });

    const idsCreados = new Set(proyectosCreados.map((proyecto) => proyecto.proyectoId));
    const resumenColaborados = colaboraciones
      .filter((colaboracion) => !idsCreados.has(colaboracion.proyectoId))
      .map(
        (colaboracion) =>
          new ProyectoResumenDto(
            colaboracion.proyecto.proyectoId,
            colaboracion.proyecto.nombre,
            colaboracion.permiso.nombre,
          ),
      );

    const todos = [
      ...proyectosCreados.map((proyecto) => new ProyectoResumenDto(proyecto.proyectoId, proyecto.nombre, ROL_CREADOR)),
      ...resumenColaborados,
    ].sort((a, b) => a.proyectoId - b.proyectoId);

    const inicio = (paginado.pagina - 1) * paginado.limite;
    return { datos: todos.slice(inicio, inicio + paginado.limite), total: todos.length };
  }

  async verificarPermisoEscritura(usuarioId: number, proyectoId: number): Promise<Proyecto> {
    const proyecto = await this.buscarPorId(proyectoId);
    await this.verificarAccesoEscritura(usuarioId, proyecto);
    return proyecto;
  }

  async verificarMiembro(usuarioId: number, proyectoId: number): Promise<string | null> {
    const proyecto = await this.buscarPorId(proyectoId);
    if (proyecto.creador?.usuarioId === usuarioId) {
      return ROL_CREADOR;
    }
    const colaborador = await this.repositorioColaboradores.findOne({
      where: { usuarioId, proyectoId },
      relations: { permiso: true },
    });
    return colaborador?.permiso?.nombre ?? null;
  }

  /** Lectura: cualquier colaborador, incluido LECTOR. */
  async verificarPermisoLectura(usuarioId: number, proyectoId: number): Promise<string> {
    const rol = await this.verificarMiembro(usuarioId, proyectoId);
    if (!rol) {
      throw new ForbiddenException('No tienes acceso a este proyecto');
    }
    return rol;
  }

  async verificarCreadorProyecto(usuarioId: number, proyectoId: number): Promise<Proyecto> {
    const proyecto = await this.buscarPorId(proyectoId);
    this.verificarCreador(proyecto, usuarioId);
    return proyecto;
  }

  private async verificarAccesoEscritura(usuarioId: number, proyecto: Proyecto): Promise<void> {
    if (proyecto.creador?.usuarioId === usuarioId) {
      return;
    }
    const colaborador = await this.repositorioColaboradores.findOne({
      where: { usuarioId, proyectoId: proyecto.proyectoId },
      relations: { permiso: true },
    });
    if (!colaborador || colaborador.permiso?.nombre !== PERMISO_EDITOR) {
      throw new ForbiddenException('No tienes permiso para modificar este proyecto');
    }
  }

  private verificarCreador(proyecto: Proyecto, usuarioId: number): void {
    if (proyecto.creador?.usuarioId !== usuarioId) {
      throw new ForbiddenException('Solo el creador del proyecto puede eliminarlo');
    }
  }
}