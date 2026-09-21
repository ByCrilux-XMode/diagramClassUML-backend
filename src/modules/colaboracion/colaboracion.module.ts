import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entorno } from '../../config/env.schema.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { ProyectosModule } from '../proyectos/proyectos.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { ColaboracionController } from './colaboracion.controller.js';
import { ColaboracionService } from './colaboracion.service.js';
import { DocumentoColaborativo } from './documento-colaborativo.entity.js';
import { PersistenciaColaboracionService } from './persistencia-colaboracion.service.js';
import { ServidorColaboracion } from './servidor-colaboracion.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Proyecto, DocumentoColaborativo]),
    UsuariosModule,
    ProyectosModule,
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
  providers: [ServidorColaboracion, PersistenciaColaboracionService, ColaboracionService],
})
export class ColaboracionModule {}