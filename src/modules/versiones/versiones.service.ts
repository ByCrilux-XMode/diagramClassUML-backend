import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersistenciaColaboracionService } from '../colaboracion/persistencia-colaboracion.service.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { ActualizarVersionDto } from './dto/actualizar-version.dto.js';
import { CrearVersionDto } from './dto/crear-version.dto.js';
import { Version } from './version.entity.js';

@Injectable()
export class VersionesService {
  constructor(
    @InjectRepository(Version) private readonly repositorioVersiones: Repository<Version>,
    private readonly proyectosService: ProyectosService,
    private readonly persistenciaColaboracion: PersistenciaColaboracionService,
  ) {}

  async listar(usuarioId: number, proyectoId: number): Promise<Version[]> {
    await this.proyectosService.verificarCreadorProyecto(usuarioId, proyectoId);
    return this.repositorioVersiones.find({
      // `proyectoId` es un `@RelationId`, no una columna: se filtra por la relación.
      where: { proyecto: { proyectoId } },
      order: { fecha: 'DESC', versionId: 'DESC' },
    });
  }

  async crear(usuarioId: number, proyectoId: number, dto: CrearVersionDto): Promise<Version> {
    await this.proyectosService.verificarCreadorProyecto(usuarioId, proyectoId);
    const proyecto = await this.obtenerEsquemaActual(proyectoId);
    const version = await this.repositorioVersiones.save(
      this.repositorioVersiones.create({
        nombre: dto.nombre.trim(),
        json: proyecto.esquemaJson as Record<string, unknown>,
        proyecto,
      }),
    );
    return this.buscarVersionDeProyecto(proyectoId, version.versionId);
  }

  async actualizar(
    usuarioId: number,
    proyectoId: number,
    versionId: number,
    dto: ActualizarVersionDto,
  ): Promise<Version> {
    await this.proyectosService.verificarCreadorProyecto(usuarioId, proyectoId);
    const version = await this.buscarVersionDeProyecto(proyectoId, versionId);
    if (dto.nombre !== undefined) {
      version.nombre = dto.nombre.trim();
    }
    if (dto.actualizarSnapshot) {
      const proyecto = await this.obtenerEsquemaActual(proyectoId);
      version.json = proyecto.esquemaJson as Record<string, unknown>;
      version.fecha = new Date();
    }
    await this.repositorioVersiones.save(version);
    return this.buscarVersionDeProyecto(proyectoId, versionId);
  }

  async eliminar(usuarioId: number, proyectoId: number, versionId: number): Promise<void> {
    await this.proyectosService.verificarCreadorProyecto(usuarioId, proyectoId);
    const version = await this.buscarVersionDeProyecto(proyectoId, versionId);
    await this.repositorioVersiones.remove(version);
  }

  async restaurar(usuarioId: number, proyectoId: number, versionId: number): Promise<Proyecto> {
    await this.proyectosService.verificarCreadorProyecto(usuarioId, proyectoId);
    const version = await this.buscarVersionDeProyecto(proyectoId, versionId);
    await this.persistenciaColaboracion.restaurar(proyectoId, version.json);
    return this.proyectosService.buscarPorId(proyectoId);
  }

  private async obtenerEsquemaActual(proyectoId: number): Promise<Proyecto> {
    await this.persistenciaColaboracion.commit(String(proyectoId));
    const proyecto = await this.proyectosService.buscarPorId(proyectoId);
    if (!proyecto.esquemaJson) {
      throw new BadRequestException('El proyecto todavía no tiene un diagrama para versionar');
    }
    return proyecto;
  }

  private async buscarVersionDeProyecto(proyectoId: number, versionId: number): Promise<Version> {
    const version = await this.repositorioVersiones.findOneBy({
      versionId,
      proyecto: { proyectoId },
    });
    if (!version) throw new NotFoundException('Versión no encontrada');
    return version;
  }
}
