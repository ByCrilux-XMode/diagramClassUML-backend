import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import { ChatStreamService } from '../chat/chat-stream.service.js';
import { CrearLotePropuestasDto, ReportarResultadoDto } from './dto/propuestas.dto.js';
import type { ListarPropuestasDto } from './dto/propuestas.dto.js';
import { agruparPropuestas, estadoResuelto } from './propuestas.agrupar.js';
import { Propuesta } from './propuesta.schema.js';
import type {
  PersonaPropuesta,
  PropuestaDocument,
} from './propuesta.schema.js';

/** Arriendo del turno: si el navegador desaparece, otro EDITOR puede tomarlo. */
export const ARRIENDO_PROPUESTA_MS = 60_000;

type ErrorEscritura = { code?: number; errmsg?: string; err?: { code?: number; errmsg?: string } };

function codigoError(error: ErrorEscritura): number | undefined {
  return error.code ?? error.err?.code;
}

function mensajeError(error: ErrorEscritura): string | undefined {
  return error.errmsg ?? error.err?.errmsg;
}

/**
 * Mongo entrega `_id` como ObjectId. Al serializarlo a JSON se convierte en un
 * objeto (`{i0,i1,...}`), que el panel usa como clave de React y termina en
 * duplicados (`[object Object]`). Se expone siempre como texto hexadecimal.
 */
function idTexto(id: unknown): string {
  if (typeof id === 'string') return id;
  const candidato = id as { toHexString?: () => string; toString?: () => string } | null;
  if (typeof candidato?.toHexString === 'function') return candidato.toHexString();
  return String(id);
}

function serializarPropuestas<T extends { _id?: unknown }>(
  documentos: T[],
): Array<Omit<T, '_id'> & { _id: string }> {
  return documentos.map(({ _id, ...resto }) => ({
    ...(resto as Omit<T, '_id'>),
    _id: idTexto(_id),
  }));
}

@Injectable()
export class PropuestasService {
  constructor(
    @InjectModel(Propuesta.name) private readonly modelo: Model<PropuestaDocument>,
    private readonly stream: ChatStreamService,
  ) {}

  /**
   * Crea el lote del turno. Es idempotente por `clavePropuesta`: un reenvío
   * devuelve lo ya guardado en lugar de duplicar documentos (D32).
   */
  async crearLote(proyectoId: number, dto: CrearLotePropuestasDto, autor: PersonaPropuesta) {
    const ahora = new Date();
    const documentos = dto.propuestas.map((propuesta) => ({
      proyectoId,
      turnoId: dto.turnoId,
      mensajeId: dto.mensajeId ?? null,
      clavePropuesta: propuesta.clavePropuesta,
      toolName: propuesta.toolName,
      args: propuesta.args,
      round: propuesta.round,
      estado: 'pendiente' as const,
      solicitadoPor: autor,
      modelo: dto.modelo ?? null,
      aprobadoPor: null,
      reclamadaEn: null,
      resueltaEn: null,
      resultado: null,
      creadoEn: ahora,
    }));

    let duplicadas = 0;
    try {
      await this.modelo.insertMany(documentos, { ordered: false });
    } catch (err: unknown) {
      const errores = (err as { writeErrors?: ErrorEscritura[] }).writeErrors;
      if (!Array.isArray(errores)) throw err;
      const otros = errores.filter((error) => codigoError(error) !== 11000);
      if (otros.length > 0) {
        throw new BadRequestException(
          `No se pudieron guardar las propuestas: ${mensajeError(otros[0]) ?? 'error desconocido'}`,
        );
      }
      duplicadas = errores.length;
    }

    const claves = documentos.map((documento) => documento.clavePropuesta);
    const guardadas = serializarPropuestas(
      await this.modelo
        .find({ proyectoId, turnoId: dto.turnoId, clavePropuesta: { $in: claves } })
        .sort({ round: 1, creadoEn: 1 })
        .lean()
        .exec(),
    );

    const creadas = documentos.length - duplicadas;
    if (creadas > 0) {
      this.stream.emitirPropuestaCreada(proyectoId, {
        turnoId: dto.turnoId,
        propuestas: guardadas,
      });
    }

    return { propuestas: guardadas, creadas, duplicadas };
  }

  async listar(proyectoId: number, filtros: ListarPropuestasDto) {
    const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 100);
    const consulta: QueryFilter<Propuesta> = { proyectoId };
    if (filtros.estado) consulta.estado = filtros.estado;

    const documentos = await this.modelo
      .find(consulta)
      .sort({ creadoEn: 1, _id: 1 })
      .limit(limite)
      .lean()
      .exec();

    return { datos: agruparPropuestas(serializarPropuestas(documentos)) };
  }

  /**
   * Reclama el turno. La unidad de decisión es el turno, así que el claim es un
   * `updateMany` condicionado: o se reclaman todas las herramientas o ninguna.
   */
  async aprobar(proyectoId: number, turnoId: string, autor: PersonaPropuesta) {
    const ahora = new Date();
    const limiteArriendo = new Date(ahora.getTime() - ARRIENDO_PROPUESTA_MS);

    const resultado = await this.modelo
      .updateMany(
        {
          proyectoId,
          turnoId,
          $or: [
            { estado: 'pendiente' },
            { estado: 'aprobando', reclamadaEn: { $lt: limiteArriendo } },
          ],
        },
        {
          $set: {
            estado: 'aprobando',
            reclamadaEn: ahora,
            aprobadoPor: autor,
          },
        },
      )
      .exec();

    if ((resultado.matchedCount ?? 0) === 0) {
      throw await this.conflicto(proyectoId, turnoId);
    }

    const propuestas = await this.listarTurno(proyectoId, turnoId);
    this.stream.emitirPropuestaResuelta(proyectoId, {
      turnoId,
      estado: 'aprobando',
      aprobadoPor: autor,
      resultado: null,
    });
    return { turnoId, propuestas };
  }

  async rechazar(proyectoId: number, turnoId: string, autor: PersonaPropuesta) {
    const ahora = new Date();
    const limiteArriendo = new Date(ahora.getTime() - ARRIENDO_PROPUESTA_MS);

    const resultado = await this.modelo
      .updateMany(
        {
          proyectoId,
          turnoId,
          $or: [
            { estado: 'pendiente' },
            { estado: 'aprobando', reclamadaEn: { $lt: limiteArriendo } },
          ],
        },
        {
          $set: {
            estado: 'rechazada',
            reclamadaEn: ahora,
            resueltaEn: ahora,
            aprobadoPor: autor,
            resultado: null,
          },
        },
      )
      .exec();

    if ((resultado.matchedCount ?? 0) === 0) {
      throw await this.conflicto(proyectoId, turnoId);
    }

    const propuestas = await this.listarTurno(proyectoId, turnoId);
    this.stream.emitirPropuestaResuelta(proyectoId, {
      turnoId,
      estado: 'rechazada',
      aprobadoPor: autor,
      resultado: null,
    });
    return { turnoId, propuestas };
  }

  /**
   * Cierra el turno con el resultado real de la aplicación. Solo puede
   * reportarlo quien lo reclamó (D27/D29).
   */
  async reportarResultado(
    proyectoId: number,
    turnoId: string,
    dto: ReportarResultadoDto,
    usuario: PersonaPropuesta,
  ) {
    const documentos = await this.modelo.find({ proyectoId, turnoId }).lean().exec();
    if (documentos.length === 0) {
      throw new NotFoundException('Turno de propuestas no encontrado');
    }

    const aprobador = documentos.find((documento) => documento.aprobadoPor)?.aprobadoPor ?? null;
    if (!aprobador || aprobador.usuarioId !== usuario.usuarioId) {
      throw new ForbiddenException('Solo quien reclamó el turno puede reportar su resultado');
    }
    if (documentos.every((documento) => estadoResuelto(documento.estado))) {
      throw new ConflictException('El turno ya está resuelto');
    }

    const resultado = {
      aplicadas: dto.aplicadas,
      errores: dto.errores ?? [],
    };
    const actualizado = await this.modelo
      .updateMany(
        {
          proyectoId,
          turnoId,
          estado: 'aprobando',
          'aprobadoPor.usuarioId': usuario.usuarioId,
        },
        {
          $set: {
            estado: dto.estado,
            resultado,
            resueltaEn: new Date(),
          },
        },
      )
      .exec();

    if ((actualizado.matchedCount ?? 0) === 0) {
      // Otra persona reclamó el turno tras vencer el arriendo.
      throw new ConflictException('El turno ya no está reclamado por ti');
    }

    const propuestas = await this.listarTurno(proyectoId, turnoId);
    this.stream.emitirPropuestaResuelta(proyectoId, {
      turnoId,
      estado: dto.estado,
      aprobadoPor: aprobador,
      resultado,
    });
    return { turnoId, propuestas };
  }

  private async listarTurno(proyectoId: number, turnoId: string) {
    return serializarPropuestas(
      await this.modelo
        .find({ proyectoId, turnoId })
        .sort({ round: 1, creadoEn: 1 })
        .lean()
        .exec(),
    );
  }

  private async conflicto(proyectoId: number, turnoId: string) {
    const documentos = await this.listarTurno(proyectoId, turnoId);
    if (documentos.length === 0) {
      throw new NotFoundException('Turno de propuestas no encontrado');
    }
    const [turno] = agruparPropuestas(documentos);
    return new ConflictException({
      mensaje: 'El turno ya fue reclamado o resuelto por otra persona.',
      turno,
    });
  }

  async eliminarPorProyecto(proyectoId: number): Promise<number> {
    const resultado = await this.modelo.deleteMany({ proyectoId }).exec();
    return resultado.deletedCount ?? 0;
  }
}
