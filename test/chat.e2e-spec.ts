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
import { Mensaje } from './../src/modules/chat/mensaje.schema.js';
import type { MensajeDocument } from './../src/modules/chat/mensaje.schema.js';
import { Sala } from './../src/modules/chat/sala.schema.js';
import type { SalaDocument } from './../src/modules/chat/sala.schema.js';

describe('Chat grupal (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let cookieLector: string;
  let cookieAjeno: string;
  let usuarioLectorId: number;
  let proyectoId: number;
  let modeloMensajes: Model<MensajeDocument>;
  let modeloSala: Model<SalaDocument>;
  let modeloEventos: Model<EventoDocument>;

  const prefijo = `e2e_chat_${Date.now()}`;

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

    modeloMensajes = app.get<Model<MensajeDocument>>(getModelToken(Mensaje.name));
    modeloSala = app.get<Model<SalaDocument>>(getModelToken(Sala.name));
    modeloEventos = app.get<Model<EventoDocument>>(getModelToken(Evento.name));

    const creador = await registrar('creador', 'Carla');
    cookie = creador.cookie;

    const lector = await registrar('lector', 'Leo');
    cookieLector = lector.cookie;
    usuarioLectorId = lector.usuarioId;

    const ajeno = await registrar('ajeno', 'Ajeno');
    cookieAjeno = ajeno.cookie;

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
      .send({ nombre: 'Proyecto chat e2e', esquemaJson: { nodeDataArray: [] } })
      .expect(201);
    proyectoId = proyecto.body.proyectoId;

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/colaboradores`)
      .set('Cookie', cookie)
      .send({ usuarioId: usuarioLectorId, permisoId: permisoLector!.permisoId })
      .expect(201);

    await modeloMensajes.syncIndexes();
    await modeloSala.syncIndexes();
  }, 60000);

  afterAll(async () => {
    if (proyectoId) {
      await modeloMensajes.deleteMany({ proyectoId }).exec();
      await modeloSala.deleteMany({ proyectoId }).exec();
      await modeloEventos.deleteMany({ proyectoId }).exec();
      await request(app.getHttpServer())
        .delete(`/proyectos/${proyectoId}`)
        .set('Cookie', cookie)
        .catch(() => undefined);
    }
    await app.close();
  }, 30000);

  const enviarTexto = (body: Record<string, unknown>, cookieSesion = cookie) =>
    request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/chat/mensajes`)
      .set('Cookie', cookieSesion)
      .send(body);

  const listar = (query: Record<string, unknown> = {}, cookieSesion = cookie) =>
    request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/chat/mensajes`)
      .query(query)
      .set('Cookie', cookieSesion);

  it('crear la sala dos veces devuelve la misma', async () => {
    const primera = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/chat/sala`)
      .set('Cookie', cookie)
      .expect(200);
    const segunda = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/chat/sala`)
      .set('Cookie', cookieLector)
      .expect(200);

    expect(String(primera.body._id)).toBe(String(segunda.body._id));
    expect(await modeloSala.countDocuments({ proyectoId })).toBe(1);
  });

  it('persiste el mensaje con el autor del token', async () => {
    // La autoría no forma parte del DTO: si el cuerpo la intenta fijar, la
    // validación lo rechaza en vez de aceptarla en silencio.
    await enviarTexto({
      contenido: 'Hola equipo',
      autorUsuarioId: 999999,
      autorNombre: 'Falsificado',
    }).expect(400);

    const respuesta = await enviarTexto({ contenido: 'Hola equipo' }).expect(201);

    expect(respuesta.body.mensaje.autorNombre).toBe('Carla Prueba');
    expect(respuesta.body.mensaje.autorUsuarioId).toBeGreaterThan(0);
    expect(respuesta.body.duplicado).toBe(false);
  });

  it('reenviar la misma clave devuelve duplicado y no inserta', async () => {
    const mensaje = { contenido: 'Mensaje idempotente', claveIdempotencia: 'clave-1' };

    const primera = await enviarTexto(mensaje).expect(201);
    const segunda = await enviarTexto(mensaje).expect(201);

    expect(primera.body.duplicado).toBe(false);
    expect(segunda.body.duplicado).toBe(true);
    expect(String(segunda.body.mensaje._id)).toBe(String(primera.body.mensaje._id));
    expect(
      await modeloMensajes.countDocuments({ proyectoId, claveIdempotencia: 'clave-1' }),
    ).toBe(1);
  });

  it('el mismo texto con claves distintas crea dos mensajes', async () => {
    const antes = await modeloMensajes.countDocuments({ proyectoId, contenido: 'Repetido' });

    await enviarTexto({ contenido: 'Repetido', claveIdempotencia: 'clave-a' }).expect(201);
    await enviarTexto({ contenido: 'Repetido', claveIdempotencia: 'clave-b' }).expect(201);

    const despues = await modeloMensajes.countDocuments({ proyectoId, contenido: 'Repetido' });
    expect(despues - antes).toBe(2);
  });

  it('un LECTOR escribe; un usuario ajeno recibe 403 y sin token 401', async () => {
    await enviarTexto({ contenido: 'Consulta del lector' }, cookieLector).expect(201);

    await enviarTexto({ contenido: 'Intruso' }, cookieAjeno).expect(403);

    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/chat/mensajes`)
      .send({ contenido: 'Sin sesión' })
      .expect(401);
  });

  it('pagina con mensajes intercalados sin repetir ni omitir', async () => {
    for (let i = 1; i <= 5; i++) {
      await enviarTexto({
        contenido: `paginado ${i}`,
        claveIdempotencia: `pagina-${i}`,
      }).expect(201);
    }

    const primera = await listar({ limite: 2 }).expect(200);
    const idsPrimera = (primera.body.datos as Array<{ _id: string }>).map((dato) => dato._id);
    expect(idsPrimera).toHaveLength(2);
    expect(primera.body.siguiente).toBeTruthy();

    const totalAntes = await modeloMensajes.countDocuments({ proyectoId });

    // Inserción intercalada entre páginas: no debe repetirse ni desplazar el cursor.
    await enviarTexto({ contenido: 'intercalado', claveIdempotencia: 'intercalado' }).expect(201);

    const vistos = new Set(idsPrimera);
    let cursor: string | null = primera.body.siguiente;

    while (cursor) {
      const pagina: { body: { datos: Array<{ _id: string }>; siguiente: string | null } } =
        await listar({ limite: 2, cursor }).expect(200);

      for (const dato of pagina.body.datos) {
        expect(vistos.has(dato._id)).toBe(false);
        vistos.add(dato._id);
      }
      cursor = pagina.body.siguiente;
    }

    expect(vistos.size).toBe(totalAntes);
  }, 30000);

  it('los sucesos se excluyen del historial de contexto', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/chat/sucesos`)
      .set('Cookie', cookie)
      .send({
        tipo: 'propuesta.aplicada',
        turnoId: 'turno-suceso',
        cambios: 3,
        claveIdempotencia: 'suceso-1',
      })
      .expect(201);

    const contexto = await listar({ contexto: true, limite: 100 }).expect(200);
    const datos = contexto.body.datos as Array<{ tipo: string; contenido: string | null }>;

    expect(datos.length).toBeGreaterThan(0);
    expect(datos.every((dato) => dato.tipo === 'texto')).toBe(true);
    expect(datos.every((dato) => typeof dato.contenido === 'string')).toBe(true);
  });

  it('un LECTOR no puede publicar sucesos', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/chat/sucesos`)
      .set('Cookie', cookieLector)
      .send({ tipo: 'propuesta.aplicada', turnoId: 'turno-lector', cambios: 1 })
      .expect(403);
  });

  it('borrar el proyecto elimina sala, mensajes y eventos', async () => {
    await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/eventos`)
      .set('Cookie', cookie)
      .send({
        eventos: [
          {
            sesionId: 'ses-borrado',
            secuencia: 1,
            actorTipo: 'humano',
            actorNombre: 'Carla',
            tipo: 'clase.crear',
            entidades: ['pedido'],
            cambios: [{ accion: 'crear', entidadTipo: 'clase', entidadKey: 'pedido' }],
            resumen: 'creó Pedido',
          },
        ],
      })
      .expect(201);

    expect(await modeloMensajes.countDocuments({ proyectoId })).toBeGreaterThan(0);
    expect(await modeloSala.countDocuments({ proyectoId })).toBe(1);
    expect(await modeloEventos.countDocuments({ proyectoId })).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete(`/proyectos/${proyectoId}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await modeloMensajes.countDocuments({ proyectoId })).toBe(0);
    expect(await modeloSala.countDocuments({ proyectoId })).toBe(0);
    expect(await modeloEventos.countDocuments({ proyectoId })).toBe(0);

    // Ya está borrado: el afterAll no necesita limpiar otra vez.
    proyectoId = 0;
  }, 30000);
});
