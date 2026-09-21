import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { PERMISO_EDITOR } from '../permisos/permiso.constantes.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto.js';
import { CrearProyectoDto } from './dto/crear-proyecto.dto.js';
import { ProyectoResumenDto, ROL_CREADOR } from './dto/proyecto-resumen.dto.js';
import { Proyecto } from './proyecto.entity.js';

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto) private readonly repositorioProyectos: Repository<Proyecto>,
    @InjectRepository(Colaborador) private readonly repositorioColaboradores: Repository<Colaborador>,
    private readonly usuariosService: UsuariosService,
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
    if (dto.nombre !== undefined) proyecto.nombre = dto.nombre;
    if (dto.esquemaJson !== undefined) proyecto.esquemaJson = dto.esquemaJson;
    await this.repositorioProyectos.save(proyecto);
    return this.buscarPorId(proyectoId);
  }

  async eliminar(usuarioId: number, proyectoId: number): Promise<void> {
    const proyecto = await this.buscarPorId(proyectoId);
    this.verificarCreador(proyecto, usuarioId);
    await this.repositorioProyectos.remove(proyecto);
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