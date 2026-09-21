import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Proyecto } from './proyecto.entity.js';
import { ProyectosController } from './proyectos.controller.js';
import { ProyectosService } from './proyectos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto, Colaborador]), forwardRef(() => UsuariosModule)],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
