import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CrearPlanDto } from './dto/planes.dto.js';
import { Plane } from './plane.schema.js';
import type { PlaneDocument } from './plane.schema.js';

interface AutorPlan {
  usuarioId: number;
  nombre: string;
}

function esDuplicado(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

@Injectable()
export class PlanesService {
  private readonly intentosDeVersion = 3;

  constructor(@InjectModel(Plane.name) private readonly modelo: Model<PlaneDocument>) {}

  /**
   * Crea una versión nueva. La versión la asigna el servidor leyendo la última
   * y el índice único resuelve la carrera: si dos personas guardan a la vez,
   * una reintenta con el número siguiente.
   */
  async crear(proyectoId: number, dto: CrearPlanDto, autor: AutorPlan): Promise<PlaneDocument> {
    const contenido = dto.contenido.trim();
    if (contenido === '') throw new ConflictException('El plan no puede estar vacío');

    for (let intento = 0; intento < this.intentosDeVersion; intento++) {
      const ultima = await this.modelo
        .findOne({ proyectoId })
        .sort({ version: -1 })
        .select({ version: 1 })
        .lean()
        .exec();

      try {
        return await this.modelo.create({
          proyectoId,
          version: (ultima?.version ?? 0) + 1,
          contenido,
          autorUsuarioId: autor.usuarioId,
          autorNombre: autor.nombre,
          origen: dto.origen,
          sustituyeA: ultima?.version ?? null,
          creadoEn: new Date(),
        });
      } catch (err: unknown) {
        if (!esDuplicado(err)) throw err;
        // Otra persona ganó la carrera por este número: se reintenta una vez.
      }
    }
    throw new ConflictException('No se pudo asignar la versión del plan; reintenta.');
  }

  async listar(proyectoId: number, limite: number): Promise<Plane[]> {
    return this.modelo
      .find({ proyectoId })
      .sort({ version: -1 })
      .limit(limite)
      .lean()
      .exec();
  }

  /** La versión vigente: la de número más alto. */
  async vigente(proyectoId: number): Promise<Plane | null> {
    return this.modelo.findOne({ proyectoId }).sort({ version: -1 }).lean().exec();
  }

  async buscarVersion(proyectoId: number, version: number): Promise<Plane> {
    const plan = await this.modelo.findOne({ proyectoId, version }).lean().exec();
    if (!plan) throw new NotFoundException(`No existe la versión ${version} de este plan`);
    return plan;
  }

  /** Limpieza al borrar el proyecto; devuelve cuántos documentos borró. */
  async eliminarPorProyecto(proyectoId: number): Promise<number> {
    const resultado = await this.modelo.deleteMany({ proyectoId }).exec();
    return resultado.deletedCount ?? 0;
  }
}
