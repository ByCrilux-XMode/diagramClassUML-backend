import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Entorno, validarEntorno } from './config/env.schema.js';
import { ConfiguracionTypeOrm } from './config/typeorm.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { ColaboracionModule } from './modules/colaboracion/colaboracion.module.js';
import { ColaboradoresModule } from './modules/colaboradores/colaboradores.module.js';
import { ConfigIaModule } from './modules/config-ia/config-ia.module.js';
import { EventosModule } from './modules/eventos/eventos.module.js';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module.js';
import { PermisosModule } from './modules/permisos/permisos.module.js';
import { PlanesModule } from './modules/planes/planes.module.js';
import { ProyectosModule } from './modules/proyectos/proyectos.module.js';
import { PropuestasModule } from './modules/propuestas/propuestas.module.js';
import { TurnosModule } from './modules/turnos/turnos.module.js';
import {
  limiteTurnos,
  opcionesThrottlerTurnos,
} from './modules/turnos/limite-turnos.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEntorno,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Entorno, true>) =>
        opcionesThrottlerTurnos(limiteTurnos(configService)),
    }),
    TypeOrmModule.forRootAsync({
      useClass: ConfiguracionTypeOrm,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Entorno, true>) => ({
        uri: configService.getOrThrow('MONGODB_URI'),
        dbName: configService.get('MONGODB_DB') ?? 'diagramador',
      }),
    }),
    UsuariosModule,
    AuthModule,
    ProyectosModule,
    ColaboradoresModule,
    PermisosModule,
    ColaboracionModule,
    EventosModule,
    ChatModule,
    PlanesModule,
    TurnosModule,
    PropuestasModule,
    ConfigIaModule,
    NotificacionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
