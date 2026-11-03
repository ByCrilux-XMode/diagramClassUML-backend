import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { Evento } from './../src/modules/eventos/evento.schema.js';
import type { EventoDocument } from './../src/modules/eventos/evento.schema.js';

interface EventoBase {
  sesionId: string;
  secuencia: number;
  actorTipo: 'humano' | 'ia' | 'sistema';
  actorNombre: string;
  tipo: string;
  entidades: string[];
  cambios: Array<{
    accion: 'crear' | 'actualizar' | 'eliminar';
    entidadTipo: 'clase' | 'relacion' | 'atributo' | 'metodo';
    entidadKey: string;
    campo?: string;
    antes?: unknown;
    despues?: unknown;
  }>;
  resumen: string;
  turnoId?: string | null;
  modelo?: string | null;
  solicitadoPor?: { usuarioId: number; nombre: string } | null;
  aprobadoPor?: { usuarioId: number; nombre: string } | null;
}

const crearEvento = (parcial: Partial<EventoBase> = {}): EventoBase => ({
  sesionId: `ses-${Math.random().toString(36).slice(2, 10)}`,
  secuencia: 1,
  actorTipo: 'humano',
  actorNombre: 'Ana',
  tipo: 'clase.crear',
  entidades: ['pedido'],
  cambios: [{ accion: 'crear', entidadTipo: 'clase', entidadKey: 'pedido' }],
  resumen: 'Ana creó la clase Pedido',
  ...parcial,
});

describe('Bitácora de eventos (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let cookieLector: string;
  let usuarioLectorId: number;
  let proyectoId: number;
  let modeloEventos: Model<EventoDocument>;

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();
    await app.listen(0);

    modeloEventos = app.get<Model<EventoDocument>>(getModelToken(Evento.name));

    const sufijo = Date.now();
    const registro = await request(app.getHttpServer())
      .post('/auth/registrarse')
      .send({ username: `e2e_ev_${sufijo}`, password: 'clave1234', nombre: 'Ana', apellido: 'Autora' })
      .expect(201);
    cookie = (registro.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

    const registroLector = await request(app.getHttpServer())
      .post('/auth/registrarse')
      .send({ username: `e2e_ev_lector_${sufijo}`, password: 'clave1234', nombre: 'Leo', apellido: 'Lector' })
      .expect(201);
    cookieLector = (registroLector.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    usuarioLectorId = registroLector.body.usuario.usuarioId;

    const permisos = await request(app.getHttpServer())
      .get('/permisos')
      .set('Cookie', cookie)
      .expect(200);
    const permisoLector = (permisos.body as Array<{ permisoId: number; nombre: string }>).find(
      (permiso) => permiso.nombre === 'LECTOR',
    );
    expect(permisoLector).toBeDefined();

    const proyecto = await request(app.getHttpServer())
      .post('/proyectos')
      .set('Cookie', cookie)
      .send({ nombre: 'Proyecto bitácora e2e', esquemaJson: { nodeDataArray: [] } })
      .expect(201);
    proyectoId = proyecto.body.proyectoId;

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/colaboradores`)
      .set('Cookie', cookie)
      .send({ usuarioId: usuarioLectorId, permisoId: permisoLector!.permisoId })
      .expect(201);

    // La colección se crea en el primer insert; los índices únicos tardan un
    // instante en construirse y el caso de idempotencia depende de ellos.
    await modeloEventos.createCollection().catch(() => undefined);
    await modeloEventos.syncIndexes();
  }, 60000);

  afterAll(async () => {
    if (proyectoId) {
      await modeloEventos.deleteMany({ proyectoId }).exec();
      await request(app.getHttpServer())
        .delete(`/proyectos/${proyectoId}`)
        .set('Cookie', cookie)
        .catch(() => undefined);
    }
    await app.close();
  }, 30000);

  const enviarLote = (eventos: EventoBase[], cookieSesion = cookie) =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/eventos`)
      .set('Cookie', cookieSesion)
      .send({ eventos });

  it('acepta un lote y responde cuántos se aceptaron y cuántos eran duplicados', async () => {
    const eventos = [
      crearEvento({ sesionId: 'ses-acepta', secuencia: 1 }),
      crearEvento({ sesionId: 'ses-acepta', secuencia: 2, tipo: 'clase.actualizar' }),
    ];

    const respuesta = await enviarLote(eventos).expect(201);

    expect(respuesta.body).toEqual({ aceptados: 2, duplicados: 0 });
  });

  it('reenviar el mismo lote no duplica documentos', async () => {
    const eventos = [
      crearEvento({ sesionId: 'ses-repetida', secuencia: 1 }),
      crearEvento({ sesionId: 'ses-repetida', secuencia: 2 }),
    ];

    await enviarLote(eventos).expect(201);
    const respuesta = await enviarLote(eventos).expect(201);

    expect(respuesta.body).toEqual({ aceptados: 0, duplicados: 2 });
    const enBase = await modeloEventos.countDocuments({ proyectoId, sesionId: 'ses-repetida' });
    expect(enBase).toBe(2);
  });

  it('un LECTOR recibe 403 al escribir y 200 al leer', async () => {
    await enviarLote([crearEvento({ sesionId: 'ses-lector' })], cookieLector).expect(403);

    const lectura = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .set('Cookie', cookieLector)
      .expect(200);
    expect(Array.isArray(lectura.body.datos)).toBe(true);
  });

  it('pagina por cursor sin repetir ni omitir aunque se inserten eventos entre páginas', async () => {
    const base = 'ses-pagina';
    for (let i = 1; i <= 5; i++) {
      await enviarLote([
        crearEvento({ sesionId: base, secuencia: i, resumen: `evento ${i}`, entidades: [`clase-${i}`] }),
      ]).expect(201);
    }

    const primera = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .query({ limite: 2, tipo: 'clase.crear' })
      .set('Cookie', cookie)
      .expect(200);

    const idsPrimera = (primera.body.datos as Array<{ _id: string }>).map((dato) => dato._id);
    expect(idsPrimera).toHaveLength(2);
    expect(primera.body.siguiente).toBeTruthy();

    // Los eventos que ya existían al abrir la primera página son exactamente
    // los que el recorrido por cursor debe alcanzar.
    const totalAntesDeInsertar = await modeloEventos
      .countDocuments({ proyectoId, tipo: 'clase.crear' })
      .exec();

    // Inserción intercalada: no debe colarse en la página siguiente ni
    // desplazar a los eventos que ya estaban en el cursor.
    await enviarLote([
      crearEvento({ sesionId: 'ses-intercalada', secuencia: 9, entidades: ['clase-nueva'] }),
    ]).expect(201);

    const vistos = new Set(idsPrimera);
    let cursor: string | null = primera.body.siguiente;

    while (cursor) {
      const pagina: { body: { datos: Array<{ _id: string }>; siguiente: string | null } } = await request(
        app.getHttpServer(),
      )
        .get(`/proyectos/${proyectoId}/eventos`)
        .query({ limite: 2, tipo: 'clase.crear', cursor })
        .set('Cookie', cookie)
        .expect(200);

      for (const dato of pagina.body.datos) {
        expect(vistos.has(dato._id)).toBe(false);
        vistos.add(dato._id);
      }
      cursor = pagina.body.siguiente;
    }

    expect(vistos.size).toBe(totalAntesDeInsertar);
  }, 30000);

  it('filtra por autor, tipo y entidad', async () => {
    await enviarLote([
      crearEvento({
        sesionId: 'ses-filtros',
        secuencia: 1,
        tipo: 'relacion.crear',
        entidades: ['pedido|Association|cliente'],
        cambios: [
          {
            accion: 'crear',
            entidadTipo: 'relacion',
            entidadKey: 'pedido|Association|cliente',
          },
        ],
      }),
    ]).expect(201);

    const porTipo = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .query({ tipo: 'relacion.crear' })
      .set('Cookie', cookie)
      .expect(200);
    expect(porTipo.body.datos.length).toBeGreaterThan(0);
    expect(
      (porTipo.body.datos as Array<{ tipo: string }>).every((dato) => dato.tipo === 'relacion.crear'),
    ).toBe(true);

    const porEntidad = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .query({ entidad: 'pedido|Association|cliente' })
      .set('Cookie', cookie)
      .expect(200);
    expect(porEntidad.body.datos.length).toBeGreaterThan(0);

    const porAutor = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .query({ actorTipo: 'humano' })
      .set('Cookie', cookie)
      .expect(200);
    expect(
      (porAutor.body.datos as Array<{ actorTipo: string }>).every(
        (dato) => dato.actorTipo === 'humano',
      ),
    ).toBe(true);
  });

  it('filtra por actorTipo=ia y conserva turno, modelo y solicitante', async () => {
    const turnoId = `turno-${Date.now()}`;
    await enviarLote([
      crearEvento({
        sesionId: 'ses-ia',
        secuencia: 1,
        actorTipo: 'ia',
        actorNombre: 'IA',
        turnoId,
        modelo: 'nvidia/nemotron-3.5-lightning:free',
        solicitadoPor: { usuarioId: 1, nombre: 'Ana Autora' },
        resumen: 'La IA creó la clase Pedido a pedido de Ana Autora',
      }),
    ]).expect(201);

    const respuesta = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .query({ actorTipo: 'ia' })
      .set('Cookie', cookie)
      .expect(200);

    const eventosIa = respuesta.body.datos as Array<{
      actorTipo: string;
      actorUsuarioId: number | null;
      turnoId: string | null;
      modelo: string | null;
      solicitadoPor: { nombre: string } | null;
    }>;

    expect(eventosIa.length).toBeGreaterThan(0);
    expect(eventosIa.every((evento) => evento.actorTipo === 'ia')).toBe(true);

    const delTurno = eventosIa.find((evento) => evento.turnoId === turnoId);
    expect(delTurno).toBeDefined();
    expect(delTurno!.actorUsuarioId).toBeNull();
    expect(delTurno!.modelo).toBe('nvidia/nemotron-3.5-lightning:free');
    expect(delTurno!.solicitadoPor?.nombre).toBe('Ana Autora');
  });

  it('el autor humano sale del token y no del cuerpo', async () => {
    await enviarLote([
      crearEvento({
        sesionId: 'ses-suplantacion',
        secuencia: 1,
        actorNombre: 'Nombre falsificado',
      }),
    ]).expect(201);

    const respuesta = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/eventos`)
      .query({ actorTipo: 'humano', limite: 100 })
      .set('Cookie', cookie)
      .expect(200);

    const suplantado = (respuesta.body.datos as Array<{ sesionId: string; actorNombre: string }>).find(
      (evento) => evento.sesionId === 'ses-suplantacion',
    );
    expect(suplantado).toBeDefined();
    expect(suplantado!.actorNombre).not.toBe('Nombre falsificado');
  });
});
