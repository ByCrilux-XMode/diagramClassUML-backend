import { NotFoundException } from '@nestjs/common';
import { TipoAccionProyecto } from './accion-proyecto.constantes.js';
import { NotificacionesService } from './notificaciones.service.js';
import { Notificacion } from './notificacion.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

describe('NotificacionesService', () => {
  let servicio: NotificacionesService;
  const repositorioNotificaciones = {
    create: vi.fn(),
    save: vi.fn(),
    findAndCount: vi.fn(),
    count: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
  };
  const repositorioUsuarios = { find: vi.fn() };
  const repositorioColaboradores = { find: vi.fn() };
  const firebaseAdminService = { enviarPush: vi.fn() };

  const proyecto = {
    proyectoId: 5,
    nombre: 'Diagrama UML',
    creador: { usuarioId: 1 },
  } as Proyecto;
  const actor = {
    usuarioId: 2,
    username: 'user2',
    persona: { personaId: 2, nombre: 'María', apellido: 'García' },
  } as Usuario;

  beforeEach(() => {
    vi.clearAllMocks();
    repositorioNotificaciones.create.mockImplementation((entidad) => entidad);
    repositorioNotificaciones.save.mockImplementation(async (entidades) => {
      if (Array.isArray(entidades)) {
        return (entidades as Notificacion[]).map((entidad, indice) => ({
          ...entidad,
          notificacionId: indice + 1,
        }));
      }
      return entidades;
    });
    repositorioNotificaciones.update.mockResolvedValue({ affected: 1 });
    firebaseAdminService.enviarPush.mockResolvedValue(true);
    servicio = new NotificacionesService(
      repositorioNotificaciones as never,
      repositorioUsuarios as never,
      repositorioColaboradores as never,
      firebaseAdminService as never,
    );
  });

  describe('notificarAccionProyecto', () => {
    it('notifica a todos los miembros excepto al actor y solo envía push a quienes tienen token', async () => {
      repositorioColaboradores.find.mockResolvedValue([
        { usuarioId: 1 },
        { usuarioId: 2 },
        { usuarioId: 3 },
      ]);
      repositorioUsuarios.find.mockResolvedValue([
        { usuarioId: 1, tokenFirebase: 'token-owner' },
        { usuarioId: 3, tokenFirebase: null },
      ]);

      await servicio.notificarAccionProyecto(TipoAccionProyecto.PROYECTO_GUARDADO, proyecto, actor);

      const llamadaUsuarios = repositorioUsuarios.find.mock.calls[0][0] as {
        where: { usuarioId: { value: number[] } };
      };
      expect(llamadaUsuarios.where.usuarioId.value).toEqual(expect.arrayContaining([1, 3]));
      expect(llamadaUsuarios.where.usuarioId.value).not.toContain(2);

      expect(repositorioNotificaciones.save).toHaveBeenCalledTimes(1);
      expect(repositorioNotificaciones.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tipoAccion: TipoAccionProyecto.PROYECTO_GUARDADO,
            titulo: 'Proyecto guardado',
            mensaje: 'María García guardó el proyecto "Diagrama UML".',
            datos: expect.objectContaining({
              actorId: '2',
              actorUsername: 'user2',
              proyectoId: '5',
            }),
          }),
        ]),
      );
      expect(firebaseAdminService.enviarPush).toHaveBeenCalledTimes(1);
      expect(firebaseAdminService.enviarPush).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'token-owner', titulo: 'Proyecto guardado' }),
      );
      expect(repositorioNotificaciones.update).toHaveBeenCalledWith(1, { enviada: true });
    });

    it('incluye el nombre de la versión cuando se restaura', async () => {
      repositorioColaboradores.find.mockResolvedValue([{ usuarioId: 3 }]);
      repositorioUsuarios.find.mockResolvedValue([{ usuarioId: 1, tokenFirebase: null }]);

      await servicio.notificarAccionProyecto(
        TipoAccionProyecto.VERSION_RESTAURADA,
        proyecto,
        actor,
        { versionId: 8, nombreVersion: 'Versión 2' },
      );

      expect(repositorioNotificaciones.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            mensaje: 'María García restauró la versión "Versión 2" del proyecto "Diagrama UML".',
            datos: expect.objectContaining({ versionId: '8', nombreVersion: 'Versión 2' }),
          }),
        ]),
      );
    });

    it('no guarda ni envía nada cuando el actor es el único miembro', async () => {
      repositorioColaboradores.find.mockResolvedValue([]);
      repositorioUsuarios.find.mockResolvedValue([]);

      await servicio.notificarAccionProyecto(TipoAccionProyecto.PROYECTO_GUARDADO, proyecto, {
        ...actor,
        usuarioId: 1,
      } as Usuario);

      expect(repositorioNotificaciones.save).not.toHaveBeenCalled();
      expect(firebaseAdminService.enviarPush).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('devuelve las notificaciones paginadas y el total de no leídas', async () => {
      repositorioNotificaciones.findAndCount.mockResolvedValue([[{ notificacionId: 1 }], 1]);
      repositorioNotificaciones.count.mockResolvedValue(1);

      const resultado = await servicio.listar(1, { pagina: 2, limite: 5 });

      expect(repositorioNotificaciones.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { destinatario: { usuarioId: 1 } },
          skip: 5,
          take: 5,
        }),
      );
      expect(resultado).toEqual({ datos: [{ notificacionId: 1 }], total: 1, noLeidas: 1 });
    });
  });

  describe('marcarLeida', () => {
    it('marca la notificación del usuario como leída', async () => {
      const notificacion = { notificacionId: 1, leida: false } as Notificacion;
      repositorioNotificaciones.findOne.mockResolvedValue(notificacion);

      const resultado = await servicio.marcarLeida(1, 1);

      expect(resultado.leida).toBe(true);
      expect(repositorioNotificaciones.save).toHaveBeenCalledWith(
        expect.objectContaining({ notificacionId: 1, leida: true }),
      );
    });

    it('lanza NotFoundException cuando la notificación no pertenece al usuario', async () => {
      repositorioNotificaciones.findOne.mockResolvedValue(null);

      await expect(servicio.marcarLeida(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('marcarTodasLeidas', () => {
    it('marca todas las notificaciones pendientes del usuario', async () => {
      repositorioNotificaciones.find.mockResolvedValue([
        { notificacionId: 1 },
        { notificacionId: 2 },
      ]);

      await servicio.marcarTodasLeidas(1);

      expect(repositorioNotificaciones.update).toHaveBeenCalledWith([1, 2], { leida: true });
    });
  });
});
