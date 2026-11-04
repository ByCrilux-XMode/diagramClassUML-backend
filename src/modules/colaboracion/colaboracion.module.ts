import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Entorno } from '../../config/env.schema.js';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { ColaboracionController } from './colaboracion.controller.js';
import { ColaboracionService } from './colaboracion.service.js';
import { PersistenciaColaboracionModule } from './persistencia-colaboracion.module.js';
import { ServidorColaboracion } from './servidor-colaboracion.js';

@Module({
  imports: [
    UsuariosModule,
    ProyectosModule,
    PersistenciaColaboracionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Entorno, true>) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: configService.getOrThrow('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [ColaboracionController],
  providers: [ServidorColaboracion, ColaboracionService],
})
export class ColaboracionModule {}