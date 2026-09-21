import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisosModule } from '../permisos/permisos.module.js';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Colaborador } from './colaborador.entity.js';
import { ColaboradoresController } from './colaboradores.controller.js';
import { ColaboradoresService } from './colaboradores.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Colaborador]),
    ProyectosModule,
    UsuariosModule,
    PermisosModule,
  ],
  controllers: [ColaboradoresController],
  providers: [ColaboradoresService],
})
export class ColaboradoresModule {}