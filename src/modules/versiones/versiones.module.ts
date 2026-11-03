import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColaboracionModule } from '../colaboracion/colaboracion.module.js';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { Version } from './version.entity.js';
import { VersionesController } from './versiones.controller.js';
import { VersionesService } from './versiones.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Version]), ProyectosModule, ColaboracionModule],
  controllers: [VersionesController],
  providers: [VersionesService],
})
export class VersionesModule {}
