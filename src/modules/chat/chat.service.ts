import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import { ChatStreamService } from './chat-stream.service.js';
import { ActualizarResumenDto, EnviarMensajeDto, EnviarSucesoDto } from './dto/chat.dto.js';
import type { ListarMensajesDto } from './dto/chat.dto.js';
import { Mensaje } from './mensaje.schema.js';
import type { MensajeDocument, PersonaMensaje } from './mensaje.schema.js';
import { Sala } from './sala.schema.js';
import type { SalaDocument } from './sala.schema.js';

interface Cursor {
  creadoEn: Date;
  id: string;
}

function codificarCursor(doc: { creadoEn: Date; _id: unknown }): string {
  return Buffer.from(`${doc.creadoEn.toISOString()}|${String(doc._id)}`).toString('base64url');
}

function decodificarCursor(cursor: string): Cursor {
  const texto = Buffer.from(cursor, 'base64url').toString('utf8');
  const separador = texto.indexOf('|');
  if (separador === -1) throw new BadRequestException('Cursor inválido');
  const creadoEn = new Date(texto.slice(0, separador));
  const id = texto.slice(separador + 1);
  if (Number.isNaN(creadoEn.getTime()) || !Types.ObjectId.isValid(id)) {
    throw new BadRequestException('Cursor inválido');
  }
  return { creadoEn, id };
}

/**
 * El `_id` de Mongo es un ObjectId. Nest lo serializa como `{ i0, i1, … }` y el
 * cliente lo usa como clave de React, que acaba en `[object Object]`. La API
 * entrega siempre el identificador como cadena, igual que la bitácora.
 */
function serializarId<T extends { _id: unknown }>(doc: T): Omit<T, '_id'> & { _id: string } {
  return { ...doc, _id: String(doc._id) };
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Sala.name) private readonly salaModel: Model<SalaDocument>,
    @InjectModel(Mensaje.name) private readonly mensajeModel: Model<MensajeDocument>,
    private readonly stream: ChatStreamService,
  ) {}

  async obtenerOCrearSala(proyectoId: number) {
    const sala = await this.salaModel
      .findOneAndUpdate(
        { proyectoId },
        { $setOnInsert: { proyectoId, tipo: 'grupo', creadaEn: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
    return sala ? serializarId(sala) : sala;
  }

  async enviarTexto(
    proyectoId: number,
    dto: EnviarMensajeDto,
    autor: PersonaMensaje,
    puedeEditar: boolean,
  ) {
    const contenido = dto.contenido.trim();
    if (contenido === '') throw new BadRequestException('El mensaje no puede estar vacío');
    if (dto.autorTipo === 'ia' && !puedeEditar) {
      throw new ForbiddenException('Solo un editor puede publicar como IA');
    }

    const sala = await this.obtenerOCrearSala(proyectoId);
    const salaId = String(sala?._id);

    const documento = {
      salaId,
      proyectoId,
      tipo: 'texto' as const,
      autorTipo: dto.autorTipo,
      autorUsuarioId: dto.autorTipo === 'humano' ? autor.usuarioId : null,
      autorNombre: dto.autorTipo === 'humano' ? autor.nombre : 'IA',
      modelo: dto.autorTipo === 'ia' ? (dto.modelo ?? null) : null,
      contenido,
      suceso: null,
      turnoId: dto.turnoId ?? null,
      solicitadoPor: dto.autorTipo === 'ia' ? (dto.solicitadoPor ?? autor) : null,
      claveIdempotencia: dto.claveIdempotencia ?? null,
      creadoEn: new Date(),
    };

    try {
      const creado = await this.mensajeModel.create(documento);
      const mensaje = serializarId(creado.toObject());
      this.stream.emitir(proyectoId, mensaje);
      return { mensaje, duplicado: false };
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000 && dto.claveIdempotencia) {
        const existente = await this.mensajeModel
          .findOne({ salaId, claveIdempotencia: dto.claveIdempotencia })
          .lean()
          .exec();
        if (existente) return { mensaje: serializarId(existente), duplicado: true };
      }
      throw err;
    }
  }

  async enviarSuceso(proyectoId: number, dto: EnviarSucesoDto, autor: PersonaMensaje) {
    const sala = await this.obtenerOCrearSala(proyectoId);
    const salaId = String(sala?._id);

    const documento = {
      salaId,
      proyectoId,
      tipo: 'suceso' as const,
      autorTipo: 'humano' as const,
      autorUsuarioId: autor.usuarioId,
      autorNombre: autor.nombre,
      modelo: null,
      contenido: null,
      suceso: {
        tipo: dto.tipo,
        turnoId: dto.turnoId,
        cambios: dto.cambios,
        errores: dto.errores ?? [],
        actor: autor,
      },
      turnoId: dto.turnoId,
      solicitadoPor: null,
      claveIdempotencia: dto.claveIdempotencia ?? null,
      creadoEn: new Date(),
    };

    try {
      const creado = await this.mensajeModel.create(documento);
      const mensaje = serializarId(creado.toObject());
      this.stream.emitir(proyectoId, mensaje);
      return { mensaje, duplicado: false };
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000 && dto.claveIdempotencia) {
        const existente = await this.mensajeModel
          .findOne({ salaId, claveIdempotencia: dto.claveIdempotencia })
          .lean()
          .exec();
        if (existente) return { mensaje: serializarId(existente), duplicado: true };
      }
      throw err;
    }
  }

  async listar(proyectoId: number, filtros: ListarMensajesDto) {
    const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 100);
    const sala = await this.obtenerOCrearSala(proyectoId);
    const salaId = String(sala?._id);

    if (filtros.contexto) {
      const docs = await this.mensajeModel
        .find({ salaId, tipo: 'texto' })
        .sort({ creadoEn: -1, _id: -1 })
        .limit(limite)
        .lean()
        .exec();
      return { datos: docs.reverse().map(serializarId), siguiente: null };
    }

    const consulta: QueryFilter<Mensaje> = { salaId };
    if (filtros.cursor) {
      const cursor = decodificarCursor(filtros.cursor);
      consulta.$or = [
        { creadoEn: { $lt: cursor.creadoEn } },
        { creadoEn: cursor.creadoEn, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }

    const encontrados = await this.mensajeModel
      .find(consulta)
      .sort({ creadoEn: -1, _id: -1 })
      .limit(limite + 1)
      .lean()
      .exec();

    const hayMas = encontrados.length > limite;
    const datos = encontrados.slice(0, limite).map(serializarId);
    const ultimo = datos[datos.length - 1];
    return {
      datos,
      siguiente: hayMas && ultimo ? codificarCursor({ creadoEn: ultimo.creadoEn, _id: ultimo._id }) : null,
    };
  }

  /**
   * Actualiza el resumen rodante solo si avanza respecto del vigente.
   *
   * - `hastaMensajeId` debe existir en la sala: el cliente no puede inventar
   *   una posición ni resumir mensajes de otro proyecto.
   * - `hastaCreadoEn` se deriva del mensaje, nunca del cuerpo.
   * - la condición de avance se resuelve en la misma escritura atómica, así
   *   dos clientes que resumen a la vez no se pisan.
   */
  async actualizarResumen(proyectoId: number, dto: ActualizarResumenDto) {
    if (!Types.ObjectId.isValid(dto.hastaMensajeId)) {
      throw new BadRequestException('El mensaje de referencia no es válido');
    }

    const sala = await this.obtenerOCrearSala(proyectoId);
    const salaId = String(sala?._id);

    const mensaje = await this.mensajeModel
      .findOne({ _id: dto.hastaMensajeId, salaId, tipo: 'texto' })
      .select({ creadoEn: 1 })
      .lean()
      .exec();
    if (!mensaje) {
      throw new NotFoundException('El mensaje de referencia no pertenece a la sala');
    }

    const hastaCreadoEn = mensaje.creadoEn;
    const actualizada = await this.salaModel
      .findOneAndUpdate(
        {
          proyectoId,
          $or: [{ resumen: null }, { 'resumen.hastaCreadoEn': { $lt: hastaCreadoEn } }],
        },
        {
          $set: {
            resumen: {
              texto: dto.texto.trim(),
              hastaMensajeId: dto.hastaMensajeId,
              hastaCreadoEn,
              modelo: dto.modelo ?? null,
              actualizadoEn: new Date(),
            },
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (actualizada) return { sala: serializarId(actualizada), actualizado: true };

    // No avanzó: se devuelve el resumen vigente sin sobrescribirlo.
    return { sala: await this.obtenerOCrearSala(proyectoId), actualizado: false };
  }

  async eliminarPorProyecto(proyectoId: number): Promise<{ mensajes: number; salas: number }> {
    const [mensajes, salas] = await Promise.all([
      this.mensajeModel.deleteMany({ proyectoId }).exec(),
      this.salaModel.deleteMany({ proyectoId }).exec(),
    ]);
    return { mensajes: mensajes.deletedCount ?? 0, salas: salas.deletedCount ?? 0 };
  }
}
