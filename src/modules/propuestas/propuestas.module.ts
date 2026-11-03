import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from '../chat/chat.module.js';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { Propuesta, PropuestaSchema } from './propuesta.schema.js';
import { PropuestasController } from './propuestas.controller.js';
import { PropuestasService } from './propuestas.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Propuesta.name, schema: PropuestaSchema }]),
    forwardRef(() => ProyectosModule),
    ChatModule,
  ],
  controllers: [PropuestasController],
  providers: [PropuestasService],
  exports: [PropuestasService],
})
export class PropuestasModule {}
