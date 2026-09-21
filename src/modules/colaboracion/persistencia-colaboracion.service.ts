import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type * as Y from 'yjs';
import { docs, setPersistence } from 'y-websocket/bin/utils';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { aplicarJson, extraerJson } from './codificador-esquema.js';
import { DEBOUNCE_AUTOSAVE_MS, ORIGEN_CARGA } from './colaboracion.constantes.js';
import { DocumentoColaborativo } from './documento-colaborativo.entity.js';

@Injectable()
export class PersistenciaColaboracionService implements OnModuleInit {
  private readonly logger = new Logger(PersistenciaColaboracionService.name);
  private readonly temporizadores = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Proyecto) private readonly repositorioProyectos: Repository<Proyecto>,
    @InjectRepository(DocumentoColaborativo)
    private readonly repositorioDocumentos: Repository<DocumentoColaborativo>,
  ) {}

  onModuleInit(): void {
    setPersistence({
      bindState: (nombreDocumento, documento) => this.vincular(nombreDocumento, documento),
      writeState: (nombreDocumento, documento) => this.persistirTemporal(nombreDocumento, documento),
    });
    this.logger.log('Persistencia de colaboración en tiempo real inicializada');
  }

  async commit(nombreDocumento: string): Promise<void> {
    const proyectoId = this.extraerProyectoId(nombreDocumento);
    if (proyectoId === null) return;
    const documento = docs.get(nombreDocumento);
    if (documento) {
      this.eliminarTemporizador(nombreDocumento);
      const esquemaJson = extraerJson(documento);
      await this.repositorioProyectos.save(
        this.repositorioProyectos.create({ proyectoId, esquemaJson }),
      );
      return;
    }
    const temporal = await this.repositorioDocumentos.findOneBy({ proyectoId });
    if (!temporal?.esquemaTemporal) return;
    await this.repositorioProyectos.save(
      this.repositorioProyectos.create({ proyectoId, esquemaJson: temporal.esquemaTemporal }),
    );
  }

  private async vincular(nombreDocumento: string, documento: Y.Doc): Promise<void> {
    const proyectoId = this.extraerProyectoId(nombreDocumento);
    if (proyectoId === null) return;
    let huboEdicionesDuranteCarga = false;
    documento.on('update', (_actualizacion, origen) => {
      if (origen === ORIGEN_CARGA) return;
      huboEdicionesDuranteCarga = true;
      this.programarAutosave(nombreDocumento, documento);
    });
    const temporal = await this.repositorioDocumentos.findOneBy({ proyectoId });
    if (huboEdicionesDuranteCarga) {
      return;
    }
    let esquema = temporal?.esquemaTemporal;
    if (!esquema) {
      const proyecto = await this.repositorioProyectos.findOneBy({ proyectoId });
      esquema = proyecto?.esquemaJson ?? undefined;
    }
    if (esquema && typeof esquema === 'object') {
      aplicarJson(documento, esquema as Record<string, unknown>);
    }
  }

  private programarAutosave(nombreDocumento: string, documento: Y.Doc): void {
    const existente = this.temporizadores.get(nombreDocumento);
    if (existente) {
      clearTimeout(existente);
    }
    const temporizador = setTimeout(() => {
      this.temporizadores.delete(nombreDocumento);
      void this.persistirTemporal(nombreDocumento, documento);
    }, DEBOUNCE_AUTOSAVE_MS);
    this.temporizadores.set(nombreDocumento, temporizador);
  }

  private eliminarTemporizador(nombreDocumento: string): void {
    const temporizador = this.temporizadores.get(nombreDocumento);
    if (temporizador) {
      clearTimeout(temporizador);
      this.temporizadores.delete(nombreDocumento);
    }
  }

  private async persistirTemporal(nombreDocumento: string, documento: Y.Doc): Promise<void> {
    this.eliminarTemporizador(nombreDocumento);
    const proyectoId = this.extraerProyectoId(nombreDocumento);
    if (proyectoId === null) return;
    const esquemaTemporal = extraerJson(documento);
    await this.repositorioDocumentos.save(
      this.repositorioDocumentos.create({ proyectoId, esquemaTemporal, actualizadoEn: new Date() }),
    );
  }

  private extraerProyectoId(nombreDocumento: string): number | null {
    const proyectoId = Number(nombreDocumento);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
      return null;
    }
    return proyectoId;
  }
}