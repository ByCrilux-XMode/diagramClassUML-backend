import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginadoDto } from '../../common/dto/paginado.dto.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { CrearVersionDto } from './dto/crear-version.dto.js';
import { VersionProyecto } from './version-proyecto.entity.js';

export interface DatosCreacionVersion extends CrearVersionDto {
  esquemaJson?: Record<string, unknown> | null;
  descripcionPredeterminada?: string;
}

@Injectable()
export class VersionesService {
  constructor(
    @InjectRepository(VersionProyecto)
    private readonly repositorioVersiones: Repository<VersionProyecto>,
  ) {}

  async crear(
    proyecto: Proyecto,
    creadoPor: Usuario,
    datos: DatosCreacionVersion = {},
  ): Promise<VersionProyecto> {
    const version = this.repositorioVersiones.create({
      proyecto,
      creadoPor,
      nombre: datos.nombre?.trim() || (await this.generarNombre(proyecto.proyectoId)),
      descripcion: datos.descripcion?.trim() || datos.descripcionPredeterminada || null,
      esquemaJson: datos.esquemaJson !== undefined ? datos.esquemaJson : proyecto.esquemaJson,
    });
    const guardada = await this.repositorioVersiones.save(version);
    return this.buscarPorId(proyecto.proyectoId, guardada.versionId);
  }

  async listar(
    proyectoId: number,
    paginado: PaginadoDto,
  ): Promise<{ datos: VersionProyecto[]; total: number }> {
    const [datos, total] = await this.repositorioVersiones.findAndCount({
      where: { proyecto: { proyectoId } },
      relations: { creadoPor: { persona: true } },
      order: { creadaEn: 'DESC' },
      skip: (paginado.pagina - 1) * paginado.limite,
      take: paginado.limite,
    });
    return { datos, total };
  }

  async buscarPorId(proyectoId: number, versionId: number): Promise<VersionProyecto> {
    const version = await this.repositorioVersiones.findOne({
      where: { versionId, proyecto: { proyectoId } },
      relations: { creadoPor: { persona: true } },
    });
    if (!version) {
      throw new NotFoundException('Versión no encontrada');
    }
    return version;
  }

  private async generarNombre(proyectoId: number): Promise<string> {
    const cantidad = await this.repositorioVersiones.count({
      where: { proyecto: { proyectoId } },
    });
    return `Versión ${cantidad + 1}`;
  }
}
