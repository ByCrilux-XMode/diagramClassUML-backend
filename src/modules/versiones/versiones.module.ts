import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VersionProyecto } from './version-proyecto.entity.js';
import { VersionesService } from './versiones.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([VersionProyecto])],
  providers: [VersionesService],
  exports: [VersionesService],
})
export class VersionesModule {}
