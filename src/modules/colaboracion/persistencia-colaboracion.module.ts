import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { DocumentoColaborativo } from './documento-colaborativo.entity.js';
import { PersistenciaColaboracionService } from './persistencia-colaboracion.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto, DocumentoColaborativo])],
  providers: [PersistenciaColaboracionService],
  exports: [PersistenciaColaboracionService],
})
export class PersistenciaColaboracionModule {}
