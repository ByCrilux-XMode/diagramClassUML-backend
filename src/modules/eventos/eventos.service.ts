import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import { Evento } from './evento.schema.js';
import type { CambioEvento, EventoDocument, PersonaEvento } from './evento.schema.js';
import { RegistrarEventosDto } from './dto/eventos.dto.js';
import type { ListarEventosDto } from './dto/eventos.dto.js';

export interface ResultadoRegistro {
  aceptados: number;
  duplicados: number;
}

export interface ResultadoUltimoTurnoIA {
  turnoId: string | null;
  eventos: Evento[];
  deshacible: boolean;
  motivo?: string;
  /** Entidades tocadas por el turno, para diagnóstico y UI. */
  entidades: string[];
}

function explicarCambioNoInvertible(cambio: CambioEvento): string | null {
  if (cambio.accion === 'crear') return null;
  if (cambio.antes !== undefined && cambio.antes !== null) return null;
  const entidad = cambio.entidadKey || cambio.entidadTipo;
  return `El cambio en «${entidad}» no tiene valor anterior; la bitácora no puede reconstruirlo.`;
}

interface Cursor {
  creadoEn: Date;
  id: string;
}

function codificarCursor(evento: { creadoEn: Date; _id: unknown }): string {
  return Buffer.from(`${evento.creadoEn.toISOString()}|${String(evento._id)}`).toString('base64url');
}

/**
 * El `_id` de Mongo es un ObjectId. Al serializarlo sin más, el interceptor de
 * Nest lo expone como `{ i0, i1, i2, i3 }` y el cliente no puede usarlo como
 * clave estable (React lo convierte en `[object Object]`). La API siempre
 * entrega el identificador como cadena.
 */
function serializarEvento<T extends { _id: unknown }>(
  evento: T,
): Omit<T, '_id'> & { _id: string } {
  return { ...evento, _id: String(evento._id) };
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

@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(@InjectModel(Evento.name) private readonly modelo: Model<EventoDocument>) {}

  async registrarLote(
    proyectoId: number,
    dto: RegistrarEventosDto,
    autor: PersonaEvento,
  ): Promise<ResultadoRegistro> {
    const ahora = new Date();
    const documentos = dto.eventos.map((evento) => {
      const esHumano = evento.actorTipo === 'humano';
      return {
        proyectoId,
        sesionId: evento.sesionId,
        secuencia: evento.secuencia,
        actorTipo: evento.actorTipo,
        // El actor humano sale del token: el cuerpo no puede suplantarlo.
        actorUsuarioId: esHumano ? autor.usuarioId : (evento.actorUsuarioId ?? null),
        actorNombre: esHumano ? autor.nombre : evento.actorNombre,
        origen: evento.origen ?? (evento.actorTipo === 'ia' ? 'ia' : 'manual'),
        tipo: evento.tipo,
        entidades: evento.entidades,
        cambios: evento.cambios,
        turnoId: evento.turnoId ?? null,
        revierteTurnoId: evento.revierteTurnoId ?? null,
        modelo: evento.modelo ?? null,
        resumen: evento.resumen,
        mensajeId: evento.mensajeId ?? null,
        solicitadoPor: evento.solicitadoPor ?? null,
        // Quien aprueba es quien hace la petición; si el cuerpo dice otra cosa,
        // se conserva la del token.
        aprobadoPor: evento.actorTipo === 'ia' && evento.aprobadoPor ? autor : (evento.aprobadoPor ?? null),
        ocurridoEn: evento.ocurridoEn ? new Date(evento.ocurridoEn) : ahora,
        creadoEn: ahora,
      };
    });

    try {
      await this.modelo.insertMany(documentos, { ordered: false });
      return { aceptados: documentos.length, duplicados: 0 };
    } catch (err: unknown) {
      // Mongoose envuelve cada fallo como `{ index, err: { code, errmsg } }`,
      // no como `{ code, errmsg }`: leer la propiedad directa deja los
      // duplicados sin detectar y un reenvío termina en 400 en vez de contar.
      type ErrorEscritura = { code?: number; errmsg?: string; err?: { code?: number; errmsg?: string } };
      const errores = (err as { writeErrors?: ErrorEscritura[] }).writeErrors;
      if (!Array.isArray(errores)) throw err;
      const codigo = (e: ErrorEscritura) => e.code ?? e.err?.code;
      const mensaje = (e: ErrorEscritura) => e.errmsg ?? e.err?.errmsg;
      const duplicados = errores.filter((e) => codigo(e) === 11000).length;
      const otros = errores.filter((e) => codigo(e) !== 11000);
      if (otros.length > 0) {
        throw new BadRequestException(
          `No se pudieron registrar los eventos: ${mensaje(otros[0]) ?? 'error desconocido'}`,
        );
      }
      return { aceptados: documentos.length - duplicados, duplicados };
    }
  }

  async listar(proyectoId: number, filtros: ListarEventosDto) {
    const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 100);
    const consulta: QueryFilter<Evento> = { proyectoId };

    if (filtros.actorTipo) consulta.actorTipo = filtros.actorTipo;
    if (filtros.actorUsuarioId !== undefined) consulta.actorUsuarioId = filtros.actorUsuarioId;
    if (filtros.actorNombre) consulta.actorNombre = filtros.actorNombre;
    if (filtros.tipo) consulta.tipo = filtros.tipo;
    if (filtros.entidad) consulta.entidades = filtros.entidad;

    // Rango por fecha de registro. Un rango invertido es un error de la
    // petición, no una consulta vacía: así el cliente corrige los filtros.
    const desde = filtros.desde ? new Date(filtros.desde) : null;
    const hasta = filtros.hasta ? new Date(filtros.hasta) : null;
    if (desde && hasta && desde.getTime() > hasta.getTime()) {
      throw new BadRequestException('Rango de fechas inválido: "desde" es posterior a "hasta"');
    }
    if (desde || hasta) {
      consulta.creadoEn = {
        ...(desde ? { $gte: desde } : {}),
        ...(hasta ? { $lte: hasta } : {}),
      };
    }

    if (filtros.cursor) {
      const cursor = decodificarCursor(filtros.cursor);
      consulta.$or = [
        { creadoEn: { $lt: cursor.creadoEn } },
        { creadoEn: cursor.creadoEn, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }

    const encontrados = await this.modelo
      .find(consulta)
      .sort({ creadoEn: -1, _id: -1 })
      .limit(limite + 1)
      .lean()
      .exec();

    const hayMas = encontrados.length > limite;
    const datos = encontrados.slice(0, limite);
    const ultimo = datos[datos.length - 1];
    return {
      datos: datos.map(serializarEvento),
      siguiente: hayMas && ultimo ? codificarCursor({ creadoEn: ultimo.creadoEn, _id: ultimo._id }) : null,
    };
  }

  async eliminarPorProyecto(proyectoId: number): Promise<number> {
    const resultado = await this.modelo.deleteMany({ proyectoId }).exec();
    return resultado.deletedCount ?? 0;
  }

  /**
   * Último turno de edición de la IA y si sigue siendo reversible (D69).
   *
   * No se usa el snapshot de `versiones`: sobrescribiría ediciones humanas
   * posteriores ajenas al lote. Se reconstruye desde `antes` y se rechaza si
   * alguna entidad cambió después.
   */
  async ultimoTurnoIA(proyectoId: number): Promise<ResultadoUltimoTurnoIA> {
    type EventoConId = Evento & { _id: Types.ObjectId };

    const ultimo = (await this.modelo
      .findOne({ proyectoId, actorTipo: 'ia', turnoId: { $ne: null } })
      .sort({ creadoEn: -1, _id: -1 })
      .lean()
      .exec()) as EventoConId | null;

    if (!ultimo?.turnoId) {
      return {
        turnoId: null,
        eventos: [],
        deshacible: false,
        motivo: 'El proyecto todavía no tiene ningún turno de edición de la IA.',
        entidades: [],
      };
    }

    const eventos = (await this.modelo
      .find({ proyectoId, turnoId: ultimo.turnoId })
      .sort({ creadoEn: 1, _id: 1 })
      .lean()
      .exec()) as EventoConId[];

    if (eventos.length === 0) {
      return {
        turnoId: ultimo.turnoId,
        eventos: [],
        deshacible: false,
        motivo: 'No se encontraron los eventos del turno de IA.',
        entidades: [],
      };
    }

    const entidades = [...new Set(eventos.flatMap((evento) => evento.entidades ?? []))];
    const cambios = eventos.flatMap((evento) => evento.cambios ?? []);
    const eventosSerializados = eventos.map(serializarEvento);

    const noInvertible = cambios
      .map((cambio) => explicarCambioNoInvertible(cambio))
      .find((motivo): motivo is string => motivo !== null);
    if (noInvertible) {
      return {
        turnoId: ultimo.turnoId,
        eventos: eventosSerializados,
        deshacible: false,
        motivo: noInvertible,
        entidades,
      };
    }

    if (cambios.length === 0) {
      return {
        turnoId: ultimo.turnoId,
        eventos: eventosSerializados,
        deshacible: false,
        motivo: 'El turno no registró cambios que se puedan deshacer.',
        entidades,
      };
    }

    const fin = eventos[eventos.length - 1]!;
    const posteriores =
      entidades.length > 0
        ? await this.modelo
            .findOne({
              proyectoId,
              turnoId: { $ne: ultimo.turnoId },
              entidades: { $in: entidades },
              $or: [
                { creadoEn: { $gt: fin.creadoEn } },
                { creadoEn: fin.creadoEn, _id: { $gt: fin._id } },
              ],
            })
            .lean()
            .exec()
        : null;

    if (posteriores) {
      return {
        turnoId: ultimo.turnoId,
        eventos: eventosSerializados,
        deshacible: false,
        motivo:
          'Una de las entidades del turno cambió después; deshacerlo pisaría trabajo humano.',
        entidades,
      };
    }

    return {
      turnoId: ultimo.turnoId,
      eventos: eventosSerializados,
      deshacible: true,
      entidades,
    };
  }
}
