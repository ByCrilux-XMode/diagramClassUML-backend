import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { Plane, PlaneSchema } from './plane.schema.js';
import { PlanesController } from './planes.controller.js';
import { PlanesService } from './planes.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plane.name, schema: PlaneSchema }]),
    forwardRef(() => ProyectosModule),
  ],
  controllers: [PlanesController],
  providers: [PlanesService],
  exports: [PlanesService],
})
export class PlanesModule {}
