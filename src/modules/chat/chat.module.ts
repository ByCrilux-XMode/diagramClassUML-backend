import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { ChatController } from './chat.controller.js';
import { ChatStreamService } from './chat-stream.service.js';
import { ChatService } from './chat.service.js';
import { Mensaje, MensajeSchema } from './mensaje.schema.js';
import { Sala, SalaSchema } from './sala.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sala.name, schema: SalaSchema },
      { name: Mensaje.name, schema: MensajeSchema },
    ]),
    forwardRef(() => ProyectosModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatStreamService],
  exports: [ChatService, ChatStreamService],
})
export class ChatModule {}
