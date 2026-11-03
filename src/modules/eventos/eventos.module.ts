import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { Evento, EventoSchema } from './evento.schema.js';
import { EventosController } from './eventos.controller.js';
import { EventosService } from './eventos.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Evento.name, schema: EventoSchema }]),
    forwardRef(() => ProyectosModule),
  ],
  controllers: [EventosController],
  providers: [EventosService],
  exports: [EventosService],
})
export class EventosModule {}
