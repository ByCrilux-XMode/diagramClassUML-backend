import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { Permiso } from './permiso.entity.js';
import { PERMISO_EDITOR, PERMISO_LECTOR } from './permiso.constantes.js';

const PERMISOS_INICIALES = [PERMISO_LECTOR, PERMISO_EDITOR] as const;

@Injectable()
export class PermisosService implements OnModuleInit {
  private readonly logger = new Logger(PermisosService.name);

  constructor(
    @InjectRepository(Permiso) private readonly repositorioPermisos: Repository<Permiso>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const cantidad = await this.repositorioPermisos.count();
    if (cantidad === 0) {
      const creados = await this.repositorioPermisos.save(
        PERMISOS_INICIALES.map((nombre) => ({ nombre })),
      );
      this.logger.log(`Permisos iniciales creados: ${creados.map((permiso) => permiso.nombre).join(', ')}`);
    }
  }

  async crear(nombre: string): Promise<Permiso> {
    return this.repositorioPermisos.save(this.repositorioPermisos.create({ nombre }));
  }

  async listar(): Promise<Permiso[]> {
    return this.repositorioPermisos.find({ order: { permisoId: 'ASC' } });
  }

  async buscarPorId(permisoId: number): Promise<Permiso> {
    const permiso = await this.repositorioPermisos.findOneBy({ permisoId });
    if (!permiso) throw new NotFoundException('Permiso no encontrado');
    return permiso;
  }

  async eliminar(permisoId: number): Promise<void> {
    const permiso = await this.buscarPorId(permisoId);
    const usos = await this.dataSource.getRepository(Colaborador).countBy({ permisoId });
    if (usos > 0) {
      throw new ConflictException(
        `El permiso '${permiso.nombre}' está asignado a ${usos} colaborador(es) y no puede eliminarse`,
      );
    }
    await this.repositorioPermisos.remove(permiso);
  }
}