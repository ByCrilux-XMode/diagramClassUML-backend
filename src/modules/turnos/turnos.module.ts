import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { TurnoIA, TurnoIASchema } from './turno.schema.js';
import { TurnosController } from './turnos.controller.js';
import { TurnosService } from './turnos.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TurnoIA.name, schema: TurnoIASchema }]),
    forwardRef(() => ProyectosModule),
  ],
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
