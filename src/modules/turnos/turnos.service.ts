import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CerrarTurnoDto, ReclamarTurnoDto } from './dto/turnos.dto.js';
import { TurnoIA } from './turno.schema.js';
import type { PersonaTurno, TurnoIADocument } from './turno.schema.js';

/** Ventana para que el navegador que reclamó reporte el cierre (D42). */
export const ARRIENDO_TURNO_MS = 120_000;

function esDuplicado(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

/**
 * `ClassSerializerInterceptor` (main.ts) recorre las propiedades propias del
 * objeto. Un documento de Mongoose las expone como `$__` y `_doc`, así que el
 * cliente recibiría `{ $__: …, _doc: { modo: … } }` en vez del turno. El resto
 * de consultas del servicio ya usan `.lean()`; el `create` es la excepción.
 */
function aObjetoPlano<T>(documento: T): T {
  const candidato = documento as T & { toObject?: () => T };
  const plano = typeof candidato?.toObject === 'function' ? candidato.toObject() : documento;
  const conId = plano as Record<string, unknown> | null;
  if (conId && typeof conId === 'object' && '_id' in conId) {
    const id = conId._id as { toString?: () => string } | undefined;
    if (id && typeof id.toString === 'function') conId._id = id.toString();
  }
  return plano;
}

@Injectable()
export class TurnosService {
  constructor(@InjectModel(TurnoIA.name) private readonly modelo: Model<TurnoIADocument>) {}

  /**
   * Reclama el único turno activo del proyecto. Si ya hay uno, responde con
   * conflicto y sus datos; solo lo roba si su arriendo venció.
   */
  async reclamar(
    proyectoId: number,
    dto: ReclamarTurnoDto,
    autor: PersonaTurno,
  ): Promise<{ turno: TurnoIA; arriendoLiberado: boolean }> {
    let arriendoLiberado = false;

    for (let intento = 0; intento < 2; intento++) {
      try {
        const turno = await this.modelo.create({
          proyectoId,
          activo: true,
          estado: 'corriendo',
          modo: dto.modo,
          salaId: dto.salaId ?? null,
          mensajeId: dto.mensajeId ?? null,
          proveedor: dto.proveedor ?? null,
          modelo: dto.modelo ?? null,
          iniciadoPor: autor,
          iniciadoEn: new Date(),
          terminadoEn: null,
          arriendo: false,
          motivo: null,
        });
        return { turno: aObjetoPlano(turno), arriendoLiberado };
      } catch (err: unknown) {
        if (!esDuplicado(err)) throw err;
        const resolucion = await this.resolverConflicto(proyectoId);
        if (resolucion === 'ocupado') throw await this.conflicto(proyectoId);
        if (resolucion === 'arriendo') arriendoLiberado = true;
      }
    }
    throw await this.conflicto(proyectoId);
  }

  /**
   * Qué hacer cuando el índice único dice que ya hay un turno activo:
   * `arriendo` si se liberó uno vencido, `ausente` si otro navegador lo cerró
   * entre medio, `ocupado` si hay que esperar.
   */
  private async resolverConflicto(
    proyectoId: number,
  ): Promise<'arriendo' | 'ausente' | 'ocupado'> {
    const activo = await this.modelo
      .findOne({ proyectoId, activo: true })
      .lean()
      .exec();
    if (!activo) return 'ausente';

    const vencido = activo.iniciadoEn.getTime() + ARRIENDO_TURNO_MS <= Date.now();
    if (!vencido) return 'ocupado';

    const liberado = await this.modelo
      .updateOne(
        { _id: activo._id, activo: true, iniciadoEn: activo.iniciadoEn },
        {
          $set: {
            activo: false,
            estado: 'error',
            arriendo: true,
            terminadoEn: new Date(),
            motivo: 'Arriendo vencido: el navegador que reclamó no reportó el cierre.',
          },
        },
      )
      .exec();
    return liberado.modifiedCount === 1 ? 'arriendo' : 'ocupado';
  }

  private async conflicto(proyectoId: number): Promise<ConflictException> {
    const activo = await this.modelo.findOne({ proyectoId, activo: true }).lean().exec();
    return new ConflictException({
      mensaje: 'Ya hay un turno de IA en curso en este proyecto.',
      turno: activo ?? null,
    });
  }

  /**
   * Cierra el turno. Solo quien lo reclamó puede reportar el cierre, y un turno
   * ya cerrado no se vuelve a tocar.
   */
  async cerrar(
    proyectoId: number,
    turnoId: string,
    dto: CerrarTurnoDto,
    usuario: PersonaTurno,
  ): Promise<TurnoIA> {
    if (!Types.ObjectId.isValid(turnoId)) {
      throw new NotFoundException('Turno no encontrado');
    }

    const cambios: Record<string, unknown> = {
      activo: false,
      estado: dto.estado,
      terminadoEn: new Date(),
      motivo: dto.motivo ?? null,
    };
    if (dto.proveedor !== undefined) cambios.proveedor = dto.proveedor;
    if (dto.modelo !== undefined) cambios.modelo = dto.modelo;

    const cerrado = await this.modelo
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(turnoId),
          proyectoId,
          activo: true,
          'iniciadoPor.usuarioId': usuario.usuarioId,
        },
        { $set: cambios },
        { new: true },
      )
      .lean()
      .exec();

    if (cerrado) return aObjetoPlano(cerrado);

    const existente = await this.modelo
      .findOne({ _id: new Types.ObjectId(turnoId), proyectoId })
      .lean()
      .exec();
    if (!existente) throw new NotFoundException('Turno no encontrado');
    if (existente.iniciadoPor.usuarioId !== usuario.usuarioId) {
      throw new ForbiddenException('Solo quien reclamó el turno puede reportar su cierre');
    }
    throw new ConflictException('El turno ya está cerrado');
  }

  /** Limpieza al borrar el proyecto; devuelve cuántos documentos borró. */
  async eliminarPorProyecto(proyectoId: number): Promise<number> {
    const resultado = await this.modelo.deleteMany({ proyectoId }).exec();
    return resultado.deletedCount ?? 0;
  }
}
