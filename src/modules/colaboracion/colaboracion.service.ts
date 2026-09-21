import { Injectable } from '@nestjs/common';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { PersistenciaColaboracionService } from './persistencia-colaboracion.service.js';

@Injectable()
export class ColaboracionService {
  constructor(
    private readonly proyectosService: ProyectosService,
    private readonly persistenciaService: PersistenciaColaboracionService,
  ) {}

  async guardar(usuarioId: number, proyectoId: number): Promise<Proyecto> {
    await this.proyectosService.verificarPermisoEscritura(usuarioId, proyectoId);
    await this.persistenciaService.commit(String(proyectoId));
    return this.proyectosService.buscarPorId(proyectoId);
  }
}