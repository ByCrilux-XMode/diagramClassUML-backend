import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import type { Credential } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';
import { Entorno } from '../../config/env.schema.js';

const NOMBRE_APP_FIREBASE = 'notificaciones-ex1';

export interface EnvioPush {
  token: string;
  titulo: string;
  mensaje: string;
  datos: Record<string, string>;
}

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private mensajeria: Messaging | null = null;

  constructor(private readonly configService: ConfigService<Entorno, true>) {}

  onModuleInit(): void {
    try {
      const credencial = this.crearCredencial();
      if (!credencial) {
        this.logger.warn(
          'Firebase Admin no está configurado. Los push se omitirán; define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY, o GOOGLE_APPLICATION_CREDENTIALS.',
        );
        return;
      }
      const appExistente = getApps().find((app) => app.name === NOMBRE_APP_FIREBASE);
      const app = appExistente ?? initializeApp({ credential: credencial }, NOMBRE_APP_FIREBASE);
      this.mensajeria = getMessaging(app);
      this.logger.log('Firebase Admin inicializado correctamente');
    } catch (error) {
      this.logger.error(`No se pudo inicializar Firebase Admin: ${this.describirError(error)}`);
    }
  }

  async enviarPush({ token, titulo, mensaje, datos }: EnvioPush): Promise<boolean> {
    if (!this.mensajeria) {
      return false;
    }
    try {
      await this.mensajeria.send({
        token,
        notification: { title: titulo, body: mensaje },
        data: datos,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      return true;
    } catch (error) {
      this.logger.warn(`No se pudo enviar la notificación push: ${this.describirError(error)}`);
      return false;
    }
  }

  private crearCredencial(): Credential | null {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (projectId && clientEmail && privateKey) {
      return cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      });
    }
    if (this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS')) {
      return applicationDefault();
    }
    return null;
  }

  private describirError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
