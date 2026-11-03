import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { Propuesta } from './../src/modules/propuestas/propuesta.schema.js';
import type { PropuestaDocument } from './../src/modules/propuestas/propuesta.schema.js';

describe('Propuestas HITL (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let cookieEditor: string;
  let cookieLector: string;
  let cookieAjeno: string;
  let usuarioEditorId: number;
  let usuarioLectorId: number;
  let proyectoId: number;
  let modeloPropuestas: Model<PropuestaDocument>;

  const prefijo = `e2e_propuestas_${Date.now()}`;

  const registrar = async (sufijo: string, nombre: string) => {
    const respuesta = await request(app.getHttpServer())
      .post('/auth/registrarse')
      .send({
        username: `${prefijo}_${sufijo}`,
        password: 'clave1234',
        nombre,
        apellido: 'Prueba',
      })
      .expect(201);
    return {
      cookie: (respuesta.headers['set-cookie'] as unknown as string[])[0].split(';')[0],
      usuarioId: respuesta.body.usuario.usuarioId as number,
    };
  };

  const crear = (turnoId: string, claves = ['a', 'b'], cookieSesion = cookie, modelo = 'modelo-x') =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/propuestas`)
      .set('Cookie', cookieSesion)
      .send({
        turnoId,
        mensajeId: '65f000000000000000000001',
        modelo,
        propuestas: claves.map((clave, indice) => ({
          clavePropuesta: clave,
          toolName: 'addClass',
          args: { key: `clase-${clave}`, name: `Clase ${clave}` },
          round: indice,
        })),
      });

  const aprobar = (turnoId: string, cookieSesion = cookie) =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/propuestas/${turnoId}/aprobar`)
      .set('Cookie', cookieSesion)
      .send({});

  const rechazar = (turnoId: string, cookieSesion = cookie) =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/propuestas/${turnoId}/rechazar`)
      .set('Cookie', cookieSesion)
      .send({});

  const reportar = (
    turnoId: string,
    cuerpo: Record<string, unknown> = { estado: 'aplicada', aplicadas: 2, errores: [] },
    cookieSesion = cookie,
  ) =>
    request(app.getHttpServer())
      .patch(`/proyectos/${proyectoId}/propuestas/${turnoId}/resultado`)
      .set('Cookie', cookieSesion)
      .send(cuerpo);

  const listar = (query: Record<string, unknown> = {}, cookieSesion = cookie) =>
    request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/propuestas`)
      .query(query)
      .set('Cookie', cookieSesion);

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

    modeloPropuestas = app.get<Model<PropuestaDocument>>(getModelToken(Propuesta.name));

    const creador = await registrar('creador', 'Carla');
    cookie = creador.cookie;

    const editor = await registrar('editor', 'Elena');
    cookieEditor = editor.cookie;
    usuarioEditorId = editor.usuarioId;

    const lector = await registrar('lector', 'Leo');
    cookieLector = lector.cookie;
    usuarioLectorId = lector.usuarioId;

    const ajeno = await registrar('ajeno', 'Ajeno');
    cookieAjeno = ajeno.cookie;

    const permisos = await request(app.getHttpServer())
      .get('/permisos')
      .set('Cookie', cookie)
      .expect(200);
    const listaPermisos = permisos.body as Array<{ permisoId: number; nombre: string }>;
    const permisoEditor = listaPermisos.find((permiso) => permiso.nombre === 'EDITOR');
    const permisoLector = listaPermisos.find((permiso) => permiso.nombre === 'LECTOR');
    expect(permisoEditor).toBeDefined();
    expect(permisoLector).toBeDefined();

    const proyecto = await request(app.getHttpServer())
      .post('/proyectos')
      .set('Cookie', cookie)
      .send({ nombre: 'Proyecto propuestas e2e', esquemaJson: { nodeDataArray: [] } })
      .expect(201);
    proyectoId = proyecto.body.proyectoId;

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/colaboradores`)
      .set('Cookie', cookie)
      .send({ usuarioId: usuarioEditorId, permisoId: permisoEditor!.permisoId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/colaboradores`)
      .set('Cookie', cookie)
      .send({ usuarioId: usuarioLectorId, permisoId: permisoLector!.permisoId })
      .expect(201);

    await modeloPropuestas.syncIndexes();
  }, 60000);

  afterAll(async () => {
    if (proyectoId) {
      await modeloPropuestas.deleteMany({ proyectoId }).exec();
      await request(app.getHttpServer())
        .delete(`/proyectos/${proyectoId}`)
        .set('Cookie', cookie)
        .catch(() => undefined);
    }
    await app?.close();
  }, 30000);

  it('crea el lote y lo lista como pendiente agrupado por turno', async () => {
    const respuesta = await crear('turno-1').expect(201);

    expect(respuesta.body.creadas).toBe(2);
    expect(respuesta.body.duplicadas).toBe(0);
    expect(respuesta.body.propuestas).toHaveLength(2);

    const lista = await listar({ estado: 'pendiente' }).expect(200);
    const turno = (lista.body.datos as Array<Record<string, unknown>>).find(
      (dato) => dato.turnoId === 'turno-1',
    );

    expect(turno).toBeDefined();
    expect(turno!.estado).toBe('pendiente');
    expect((turno!.solicitadoPor as { nombre: string }).nombre).toBe('Carla Prueba');
    expect(turno!.modelo).toBe('modelo-x');
    expect(turno!.propuestas).toHaveLength(2);
    expect(turno!.resumen).toContain('addClass');
  });

  it('reenviar el mismo lote no duplica documentos', async () => {
    const respuesta = await crear('turno-1').expect(201);

    expect(respuesta.body.creadas).toBe(0);
    expect(respuesta.body.duplicadas).toBe(2);
    expect(
      await modeloPropuestas.countDocuments({ proyectoId, turnoId: 'turno-1' }),
    ).toBe(2);
  });

  it('un LECTOR no puede crear, aprobar ni rechazar', async () => {
    await crear('turno-lector', ['a'], cookieLector).expect(403);
    await aprobar('turno-1', cookieLector).expect(403);
    await rechazar('turno-1', cookieLector).expect(403);
    expect(
      await modeloPropuestas.countDocuments({ proyectoId, turnoId: 'turno-lector' }),
    ).toBe(0);
  });

  it('un usuario ajeno recibe 403 y sin sesión 401', async () => {
    await listar({}, cookieAjeno).expect(403);
    await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/propuestas`)
      .expect(401);
    await crear('turno-ajeno', ['a'], cookieAjeno).expect(403);
  });

  it('dos aprobaciones concurrentes: una gana y la otra recibe 409', async () => {
    await crear('turno-carrera').expect(201);

    const respuestas = await Promise.all([
      aprobar('turno-carrera', cookie),
      aprobar('turno-carrera', cookieEditor),
    ]);
    const estados = respuestas.map((respuesta) => respuesta.status).sort();

    expect(estados).toEqual([201, 409]);
    const perdedora = respuestas.find((respuesta) => respuesta.status === 409);
    expect(perdedora!.body.turno.estado).toBe('aprobando');

    const ganadora = respuestas.find((respuesta) => respuesta.status === 201)!;
    expect(ganadora.body.propuestas).toHaveLength(2);
  });

  it('reporta el resultado del turno reclamado y lo deja aplicado', async () => {
    const respuesta = await reportar('turno-carrera').expect(200);
    expect(respuesta.body.propuestas.every((p: { estado: string }) => p.estado === 'aplicada')).toBe(
      true,
    );
  });

  it('no permite reportar el resultado de un turno que no se reclamó', async () => {
    await crear('turno-sin-reclamo', ['a']).expect(201);
    await reportar('turno-sin-reclamo').expect(403);
  });

  it('reportar un turno ya resuelto devuelve 409', async () => {
    await reportar('turno-carrera').expect(409);
  });

  it('rechazar un turno resuelto devuelve 409', async () => {
    await rechazar('turno-carrera', cookieEditor).expect(409);
  });

  it('un arriendo vencido permite que otro EDITOR reclame el turno', async () => {
    await crear('turno-arriendo', ['a']).expect(201);
    await aprobar('turno-arriendo', cookieEditor).expect(201);

    await modeloPropuestas
      .updateMany(
        { proyectoId, turnoId: 'turno-arriendo' },
        { $set: { reclamadaEn: new Date(Date.now() - 120_000) } },
      )
      .exec();

    const reclamado = await aprobar('turno-arriendo', cookie).expect(201);
    expect(reclamado.body.propuestas[0].aprobadoPor.nombre).toBe('Carla Prueba');

    // El reclamante anterior ya no puede reportar.
    await reportar('turno-arriendo', { estado: 'aplicada', aplicadas: 1 }, cookieEditor).expect(403);
    await reportar('turno-arriendo', { estado: 'aplicada', aplicadas: 1 }, cookie).expect(200);
  });

  it('rechazar un turno pendiente lo deja rechazado sin aprobación', async () => {
    await crear('turno-rechazo', ['a']).expect(201);
    const respuesta = await rechazar('turno-rechazo', cookieEditor).expect(201);

    expect(respuesta.body.propuestas[0].estado).toBe('rechazada');
    expect(respuesta.body.propuestas[0].aprobadoPor.nombre).toBe('Elena Prueba');
    await aprobar('turno-rechazo', cookie).expect(409);
  });

  it('borrar el proyecto elimina sus propuestas', async () => {
    expect(await modeloPropuestas.countDocuments({ proyectoId })).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete(`/proyectos/${proyectoId}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await modeloPropuestas.countDocuments({ proyectoId })).toBe(0);
    proyectoId = 0;
  }, 30000);
});
