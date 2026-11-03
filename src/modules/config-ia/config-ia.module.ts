import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { ConfigIaController } from './config-ia.controller.js';
import { ConfigIa, ConfigIaSchema } from './config-ia.schema.js';
import { ConfigIaService } from './config-ia.service.js';
import { ValidadorModelosService } from './validador-modelos.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ConfigIa.name, schema: ConfigIaSchema }]),
    forwardRef(() => ProyectosModule),
  ],
  controllers: [ConfigIaController],
  providers: [ConfigIaService, ValidadorModelosService],
  exports: [ConfigIaService],
})
export class ConfigIaModule {}
