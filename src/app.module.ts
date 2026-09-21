import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validarEntorno } from './config/env.schema.js';
import { ConfiguracionTypeOrm } from './config/typeorm.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ColaboracionModule } from './modules/colaboracion/colaboracion.module.js';
import { ColaboradoresModule } from './modules/colaboradores/colaboradores.module.js';
import { PermisosModule } from './modules/permisos/permisos.module.js';
import { ProyectosModule } from './modules/proyectos/proyectos.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEntorno,
    }),
    TypeOrmModule.forRootAsync({
      useClass: ConfiguracionTypeOrm,
    }),
    UsuariosModule,
    AuthModule,
    ProyectosModule,
    ColaboradoresModule,
    PermisosModule,
    ColaboracionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}