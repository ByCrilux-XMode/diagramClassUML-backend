import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { TurnoIA } from './../src/modules/turnos/turno.schema.js';
import type { TurnoIADocument } from './../src/modules/turnos/turno.schema.js';

describe('Turnos de IA (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let cookieEditor: string;
  let cookieLector: string;
  let cookieAjeno: string;
  let usuarioEditorId: number;
  let usuarioLectorId: number;
  let proyectoId: number;
  let modeloTurnos: Model<TurnoIADocument>;

  const prefijo = `e2e_turnos_${Date.now()}`;

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

  const reclamar = (
    modo: 'plan' | 'build',
    cookieSesion = cookie,
  ) =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/turnos`)
      .set('Cookie', cookieSesion)
      .send({ modo });

  const cerrar = (
    turnoId: string,
    estado: 'listo' | 'error' = 'listo',
    cookieSesion = cookie,
  ) =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/turnos/${turnoId}/estado`)
      .set('Cookie', cookieSesion)
      .send({ estado });

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

    modeloTurnos = app.get<Model<TurnoIADocument>>(getModelToken(TurnoIA.name));

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
      .send({ nombre: 'Proyecto turnos e2e', esquemaJson: { nodeDataArray: [] } })
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

    await modeloTurnos.syncIndexes();
  }, 60000);

  afterAll(async () => {
    if (proyectoId) {
      await modeloTurnos.deleteMany({ proyectoId }).exec();
      await request(app.getHttpServer())
        .delete(`/proyectos/${proyectoId}`)
        .set('Cookie', cookie)
        .catch(() => undefined);
    }
    await app?.close();
  }, 30000);

  it('un LECTOR recibe 403 al reclamar un turno build', async () => {
    await reclamar('build', cookieLector).expect(403);
    expect(await modeloTurnos.countDocuments({ proyectoId })).toBe(0);
  });

  it('un LECTOR sí puede reclamar un turno plan', async () => {
    const respuesta = await reclamar('plan', cookieLector).expect(201);

    expect(respuesta.body.turno.modo).toBe('plan');
    expect(respuesta.body.turno.activo).toBe(true);
    expect(respuesta.body.turno.iniciadoPor.nombre).toBe('Leo Prueba');

    await cerrar(respuesta.body.turno._id, 'listo', cookieLector).expect(201);
  });

  it('un usuario ajeno recibe 403 y sin sesión 401', async () => {
    await reclamar('build', cookieAjeno).expect(403);
    await reclamar('plan', cookieAjeno).expect(403);
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/turnos`)
      .send({ modo: 'plan' })
      .expect(401);
  });

  it('solo hay un turno activo: el segundo reclamo devuelve 409 con quién lo tiene', async () => {
    const primero = await reclamar('build', cookie).expect(201);

    const segundo = await reclamar('build', cookieEditor).expect(409);
    expect(segundo.body.turno).not.toBeNull();
    expect(segundo.body.turno.iniciadoPor.nombre).toBe('Carla Prueba');

    await cerrar(primero.body.turno._id).expect(201);
  });

  it('un turno cerrado no admite un segundo reporte', async () => {
    const { body } = await reclamar('plan', cookie).expect(201);
    await cerrar(body.turno._id, 'error').expect(201);
    await cerrar(body.turno._id, 'listo').expect(409);
  });

  it('solo quien reclamó puede cerrar el turno', async () => {
    const { body } = await reclamar('plan', cookie).expect(201);

    await cerrar(body.turno._id, 'listo', cookieEditor).expect(403);
    await cerrar(body.turno._id).expect(201);
  });

  it('un arriendo vencido se libera y permite reclamar de nuevo', async () => {
    const viejo = await reclamar('build', cookieEditor).expect(201);

    await modeloTurnos
      .updateOne(
        { _id: viejo.body.turno._id },
        { $set: { iniciadoEn: new Date(Date.now() - 130_000) } },
      )
      .exec();

    const nuevo = await reclamar('build', cookie).expect(201);
    expect(nuevo.body.arriendoLiberado).toBe(true);
    expect(nuevo.body.turno.activo).toBe(true);
    expect(nuevo.body.turno.iniciadoPor.nombre).toBe('Carla Prueba');

    const liberado = await modeloTurnos
      .findById(viejo.body.turno._id)
      .lean()
      .exec();
    expect(liberado?.activo).toBe(false);
    expect(liberado?.estado).toBe('error');
    expect(liberado?.arriendo).toBe(true);

    await cerrar(nuevo.body.turno._id).expect(201);
  });

  it('borrar el proyecto elimina sus turnos', async () => {
    expect(await modeloTurnos.countDocuments({ proyectoId })).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete(`/proyectos/${proyectoId}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await modeloTurnos.countDocuments({ proyectoId })).toBe(0);
    proyectoId = 0;
  }, 30000);
});
