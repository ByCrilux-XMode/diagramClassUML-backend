import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { App } from 'supertest/types';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { AppModule } from './../src/app.module.js';
import { Y } from './../src/modules/colaboracion/yjs-servidor.js';

interface ConexionAbierta {
  socket: WebSocket;
  esperarSync: Promise<Buffer>;
}

describe('Colaboración en tiempo real (e2e)', () => {
  let app: INestApplication<App>;
  let puerto: number;
  let cookie: string;
  let proyectoId: number;
  let socketsAbiertos: WebSocket[] = [];

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();
    await app.listen(0);
    puerto = (app.getHttpServer().address() as AddressInfo).port;

    const usuario = `e2e_${Date.now()}`;
    const registro = await request(app.getHttpServer())
      .post('/auth/registrarse')
      .send({ username: usuario, password: 'clave1234', nombre: 'E2E', apellido: 'Colab' })
      .expect(201);
    cookie = (registro.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

    const proyecto = await request(app.getHttpServer())
      .post('/proyectos')
      .set('Cookie', cookie)
      .send({ nombre: 'Proyecto e2e', esquemaJson: { nodeDataArray: [] } })
      .expect(201);
    proyectoId = proyecto.body.proyectoId;
  }, 20000);

  afterAll(async () => {
    for (const socket of socketsAbiertos) {
      socket.close();
    }
    socketsAbiertos = [];
    await new Promise((resolver) => setTimeout(resolver, 200));
    await app.close();
  }, 20000);

  const aBuffer = (datos: WebSocket.RawData): Buffer =>
    Buffer.isBuffer(datos) ? datos : Buffer.from(datos as ArrayBuffer);

  const abrirConexion = async (url: string, cookieSesion?: string): Promise<ConexionAbierta> => {
    const socket = new WebSocket(url, { headers: cookieSesion ? { Cookie: cookieSesion } : undefined });
    socketsAbiertos.push(socket);

    const esperarSync = new Promise<Buffer>((resolver, rechazar) => {
      const temporizador = setTimeout(() => rechazar(new Error('Timeout esperando sync inicial')), 4000);
      socket.once('message', (datos) => {
        clearTimeout(temporizador);
        resolver(aBuffer(datos));
      });
    });
    esperarSync.catch(() => undefined);

    await new Promise<void>((resolver, rechazar) => {
      socket.once('open', () => resolver());
      socket.once('error', rechazar);
      socket.on('unexpected-response', (_peticion, respuesta) => {
        rechazar(new Error(`Handshake WS rechazado: HTTP ${respuesta.statusCode}`));
        respuesta.destroy();
      });
    });

    return { socket, esperarSync };
  };

  it('acepta una conexión autenticada y entrega el sync inicial de Yjs', async () => {
    const { socket, esperarSync } = await abrirConexion(
      `ws://127.0.0.1:${puerto}/colaboracion?proyectoId=${proyectoId}`,
      cookie,
    );

    const primerMensaje = await esperarSync;

    expect(primerMensaje[0]).toBe(0);
    socket.close();
  });

  it('rechaza la conexión sin token con HTTP 401', async () => {
    await expect(
      abrirConexion(`ws://127.0.0.1:${puerto}/colaboracion?proyectoId=${proyectoId}`),
    ).rejects.toThrow('HTTP 401');
  });

  it('concretiza el diagrama con guardar-colaboracion', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/guardar-colaboracion`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.proyectoId).toBe(proyectoId);
  });

  it('persiste una edición remota con guardar-colaboracion', async () => {
    const doc = new Y.Doc();
    const proveedor = new WebsocketProvider(
      `ws://127.0.0.1:${puerto}/colaboracion`,
      String(proyectoId),
      doc,
      {
        WebSocketPolyfill: crearSocketColaboracion(String(proyectoId), cookie),
      },
    );
    socketsAbiertos.push(proveedor.ws);

    await esperarSincronizacion(proveedor);

    const mapa = doc.getMap<unknown>('esquema');
    doc.transact(() => {
      mapa.set('class', 'GraphLinksModel');
      const arreglo = new Y.Array<unknown>();
      const nodo = new Y.Map<unknown>();
      nodo.set('key', 'n1');
      nodo.set('name', 'Clase');
      arreglo.push([nodo]);
      mapa.set('nodeDataArray', arreglo);
    });

    await new Promise((resolver) => setTimeout(resolver, 300));

    proveedor.destroy();
    await new Promise((resolver) => setTimeout(resolver, 500));

    const respuesta = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/guardar-colaboracion`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.esquemaJson).toEqual({
      class: 'GraphLinksModel',
      nodeDataArray: [{ key: 'n1', name: 'Clase' }],
    });
  });

  const crearSocketColaboracion = (identificadorProyecto: string, cookieSesion?: string): typeof WebSocket =>
    class ColaboracionWebSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const urlFinal = new URL(String(url));
        urlFinal.pathname = '/colaboracion';
        urlFinal.searchParams.set('proyectoId', identificadorProyecto);
        super(urlFinal.href, protocols, { headers: cookieSesion ? { Cookie: cookieSesion } : undefined });
      }
    };

  const esperarSincronizacion = (proveedor: WebsocketProvider): Promise<void> =>
    new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(
        () => rechazar(new Error('Timeout esperando sincronización del proveedor')),
        5000,
      );
      proveedor.on('sync', (sincronizado: boolean) => {
        if (sincronizado) {
          clearTimeout(temporizador);
          resolver();
        }
      });
    });
});