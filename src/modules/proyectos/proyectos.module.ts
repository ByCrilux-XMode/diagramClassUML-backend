import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { PersistenciaColaboracionModule } from '../colaboracion/persistencia-colaboracion.module.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { VersionesModule } from '../versiones/versiones.module.js';
import { Proyecto } from './proyecto.entity.js';
import { ProyectosController } from './proyectos.controller.js';
import { ProyectosService } from './proyectos.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Proyecto, Colaborador]),
    forwardRef(() => UsuariosModule),
    VersionesModule,
    NotificacionesModule,
    PersistenciaColaboracionModule,
  ],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
