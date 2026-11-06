import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module.js';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { PersistenciaColaboracionModule } from '../colaboracion/persistencia-colaboracion.module.js';
import { ConfigIaModule } from '../config-ia/config-ia.module.js';
import { EventosModule } from '../eventos/eventos.module.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { PlanesModule } from '../planes/planes.module.js';
import { PropuestasModule } from '../propuestas/propuestas.module.js';
import { TurnosModule } from '../turnos/turnos.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { VersionesModule } from '../versiones/versiones.module.js';
import { Proyecto } from './proyecto.entity.js';
import { ProyectosController } from './proyectos.controller.js';
import { ProyectosService } from './proyectos.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Proyecto, Colaborador]),
    forwardRef(() => UsuariosModule),
    forwardRef(() => EventosModule),
    forwardRef(() => ChatModule),
    forwardRef(() => PlanesModule),
    forwardRef(() => TurnosModule),
    forwardRef(() => PropuestasModule),
    forwardRef(() => ConfigIaModule),
    VersionesModule,
    NotificacionesModule,
    PersistenciaColaboracionModule,
  ],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
