import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { Notificacion } from './notificacion.entity.js';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notificacion, Usuario, Colaborador])],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, FirebaseAdminService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
