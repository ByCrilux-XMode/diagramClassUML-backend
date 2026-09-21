import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Entorno } from './env.schema.js';

@Injectable()
export class ConfiguracionTypeOrm implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService<Entorno, true>) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const ssl = this.configService.get('DB_SSL') ? { rejectUnauthorized: false } : undefined;
    const url = this.configService.get('DATABASE_URL');
    if (url) {
      return {
        type: 'postgres',
        url,
        ssl,
        autoLoadEntities: true,
        synchronize: true,
      };
    }
    return {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      ssl,
      autoLoadEntities: true,
      synchronize: true,
    };
  }
}