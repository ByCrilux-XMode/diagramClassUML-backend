import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActualizarConfigIaDto } from './dto/config-ia.dto.js';
import { ConfigIa, PROVEEDORES_CONFIG } from './config-ia.schema.js';
import type {
  CadenasConfig,
  ConfigIaDocument,
  PersonaConfig,
  ProveedorConfig,
  TareaConfig,
  TramoConfig,
} from './config-ia.schema.js';
import { ValidadorModelosService } from './validador-modelos.service.js';

const TAREAS: TareaConfig[] = ['edicion', 'consulta', 'resumen'];

export interface ConfigIaEfectiva {
  proyectoId: number;
  proveedor: ProveedorConfig;
  modelo: string | null;
  cadenas: CadenasConfig;
  actualizadoPor: PersonaConfig | null;
  actualizadoEn: Date | null;
  porDefecto: boolean;
}

function esProveedor(valor: string): valor is ProveedorConfig {
  return (PROVEEDORES_CONFIG as readonly string[]).includes(valor);
}

/**
 * Cadena en formato `proveedor:modelo,proveedor`. Ollama se rechaza de forma
 * explícita: sigue existiendo como adaptador, pero no es una opción de cadena
 * (D61).
 */
export function parsearCadena(valor: string): TramoConfig[] {
  const texto = (valor ?? '').trim();
  if (texto === '') return [];
  return texto.split(',').map((parte) => {
    const tramo = parte.trim();
    if (tramo === '') throw new BadRequestException('La cadena contiene un tramo vacío.');
    const separador = tramo.indexOf(':');
    const proveedor = (separador === -1 ? tramo : tramo.slice(0, separador)).trim().toLowerCase();
    if (proveedor === 'ollama') {
      throw new BadRequestException(
        'Ollama no forma parte de la cadena de proveedores. Usa openrouter, hf-space o huggingface.',
      );
    }
    if (!esProveedor(proveedor)) {
      throw new BadRequestException(`Proveedor no permitido en la cadena: ${proveedor}`);
    }
    const modelo = separador === -1 ? '' : tramo.slice(separador + 1).trim();
    return { proveedor, modelo: modelo === '' ? null : modelo };
  });
}

function cadenaDeEntorno(variable: string, porDefecto: string): TramoConfig[] {
  return parsearCadena(process.env[variable]?.trim() || porDefecto);
}

/** Defaults de D55, sobreescribibles por `.env`. */
export const CADENAS_POR_DEFECTO: CadenasConfig = {
  edicion: cadenaDeEntorno('IA_CADENA_EDICION', 'openrouter,hf-space'),
  consulta: cadenaDeEntorno('IA_CADENA_CONSULTA', 'hf-space,openrouter'),
  resumen: cadenaDeEntorno('IA_CADENA_RESUMEN', 'hf-space'),
};

function clonarCadenas(cadenas: CadenasConfig): CadenasConfig {
  return {
    edicion: cadenas.edicion.map((tramo) => ({ ...tramo })),
    consulta: cadenas.consulta.map((tramo) => ({ ...tramo })),
    resumen: cadenas.resumen.map((tramo) => ({ ...tramo })),
  };
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
export class ConfigIaService {
  private readonly logger = new Logger(ConfigIaService.name);

  constructor(
    @InjectModel(ConfigIa.name) private readonly modelo: Model<ConfigIaDocument>,
    private readonly validador: ValidadorModelosService,
  ) {}

  /** Configuración efectiva: la guardada o los defaults de D55. */
  async obtener(proyectoId: number): Promise<ConfigIaEfectiva> {
    const documento = await this.modelo.findOne({ proyectoId }).lean().exec();
    if (!documento) return this.porDefecto(proyectoId);
    return {
      proyectoId,
      proveedor: documento.proveedor ?? documento.cadenas.edicion[0]?.proveedor ?? 'openrouter',
      modelo: documento.modelo ?? null,
      cadenas: clonarCadenas(documento.cadenas),
      actualizadoPor: documento.actualizadoPor ?? null,
      actualizadoEn: documento.actualizadoEn ?? null,
      porDefecto: false,
    };
  }

  async actualizar(
    proyectoId: number,
    dto: ActualizarConfigIaDto,
    autor: PersonaConfig,
  ): Promise<ConfigIaEfectiva> {
    const actual = await this.obtener(proyectoId);
    const cadenas = clonarCadenas(actual.cadenas);

    if (dto.cadenas) {
      for (const tarea of TAREAS) {
        const tramos = dto.cadenas[tarea];
        if (tramos === undefined) continue;
        if (tramos.length === 0) {
          throw new BadRequestException(`La cadena de ${tarea} no puede quedar vacía.`);
        }
        cadenas[tarea] = tramos.map((tramo) => this.normalizarTramo(tramo));
      }
    }

    const proveedor = dto.proveedor ?? actual.proveedor;
    if (!esProveedor(proveedor)) {
      throw new BadRequestException(`Proveedor no permitido: ${String(proveedor)}`);
    }
    const modelo =
      dto.modelo !== undefined ? (dto.modelo.trim() === '' ? null : dto.modelo.trim()) : actual.modelo;

    await this.validarModelo(proveedor, modelo);

    const cambios = {
      proyectoId,
      proveedor,
      modelo,
      cadenas,
      actualizadoPor: autor,
      actualizadoEn: new Date(),
    };

    try {
      const guardado = await this.modelo
        .findOneAndUpdate({ proyectoId }, { $set: cambios }, { new: true, upsert: true })
        .lean()
        .exec();
      return this.desdeDocumento(proyectoId, guardado);
    } catch (err: unknown) {
      if (!esDuplicado(err)) throw err;
      // Dos PATCH simultáneos: el índice único decide y el segundo actualiza.
      const guardado = await this.modelo
        .findOneAndUpdate({ proyectoId }, { $set: cambios }, { new: true })
        .lean()
        .exec();
      return this.desdeDocumento(proyectoId, guardado);
    }
  }

  async eliminarPorProyecto(proyectoId: number): Promise<number> {
    const resultado = await this.modelo.deleteMany({ proyectoId }).exec();
    return resultado.deletedCount ?? 0;
  }

  private normalizarTramo(tramo: {
    proveedor: string;
    modelo?: string;
  }): TramoConfig {
    const proveedor = tramo.proveedor.trim().toLowerCase();
    if (proveedor === 'ollama' || !esProveedor(proveedor)) {
      throw new BadRequestException(`Proveedor no permitido en la cadena: ${tramo.proveedor}`);
    }
    const modelo = tramo.modelo?.trim() ?? '';
    return { proveedor, modelo: modelo === '' ? null : modelo };
  }

  private async validarModelo(
    proveedor: ProveedorConfig,
    modelo: string | null,
  ): Promise<void> {
    if (!modelo) return;
    const disponibles = await this.validador.modelosDe(proveedor);
    // `null` significa que no se pudo comprobar: no se bloquea el guardado.
    if (!disponibles || disponibles.length === 0) return;
    if (!disponibles.includes(modelo)) {
      throw new BadRequestException(
        `El modelo ${modelo} no está disponible en ${proveedor}.`,
      );
    }
    this.logger.debug(`Modelo ${modelo} validado contra ${proveedor}`);
  }

  private desdeDocumento(
    proyectoId: number,
    documento: ConfigIa | null,
  ): ConfigIaEfectiva {
    if (!documento) return this.porDefecto(proyectoId);
    return {
      proyectoId,
      proveedor: documento.proveedor ?? documento.cadenas.edicion[0]?.proveedor ?? 'openrouter',
      modelo: documento.modelo ?? null,
      cadenas: clonarCadenas(documento.cadenas),
      actualizadoPor: documento.actualizadoPor ?? null,
      actualizadoEn: documento.actualizadoEn ?? null,
      porDefecto: false,
    };
  }

  private porDefecto(proyectoId: number): ConfigIaEfectiva {
    const cadenas = clonarCadenas(CADENAS_POR_DEFECTO);
    return {
      proyectoId,
      proveedor: cadenas.edicion[0]?.proveedor ?? 'openrouter',
      modelo: null,
      cadenas,
      actualizadoPor: null,
      actualizadoEn: null,
      porDefecto: true,
    };
  }
}
