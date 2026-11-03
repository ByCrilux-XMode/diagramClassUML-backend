import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Version } from './version.entity.js';
import { VersionesService } from './versiones.service.js';

describe('VersionesService', () => {
  let servicio: VersionesService;
  const repositorioVersiones = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const proyectosService = {
    verificarCreadorProyecto: vi.fn(),
    buscarPorId: vi.fn(),
  };
  const persistenciaColaboracion = {
    commit: vi.fn(),
    restaurar: vi.fn(),
  };

  const crearProyecto = (esquemaJson: Record<string, unknown> | null = { nodeDataArray: [] }) =>
    ({ proyectoId: 5, esquemaJson, creador: { usuarioId: 1 } });

  const crearVersion = (versionId = 10): Version =>
    ({
      versionId,
      proyectoId: 5,
      nombre: 'Versión 1',
      json: { nodeDataArray: [] },
      fecha: new Date('2026-01-01T00:00:00Z'),
    }) as Version;

  beforeEach(() => {
    vi.clearAllMocks();
    servicio = new VersionesService(
      repositorioVersiones as never,
      proyectosService as never,
      persistenciaColaboracion as never,
    );
  });

  describe('listar', () => {
    it('verifica que sea el creador y devuelve las versiones', async () => {
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      repositorioVersiones.find.mockResolvedValue([crearVersion()]);

      const resultado = await servicio.listar(1, 5);

      expect(proyectosService.verificarCreadorProyecto).toHaveBeenCalledWith(1, 5);
      expect(repositorioVersiones.find).toHaveBeenCalledWith({
        where: { proyecto: { proyectoId: 5 } },
        order: { fecha: 'DESC', versionId: 'DESC' },
      });
      expect(resultado).toHaveLength(1);
    });

    it('propaga ForbiddenException si no es el creador', async () => {
      proyectosService.verificarCreadorProyecto.mockRejectedValue(new ForbiddenException());

      await expect(servicio.listar(2, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorioVersiones.find).not.toHaveBeenCalled();
    });
  });

  describe('crear', () => {
    it('persiste el estado colaborativo y guarda el esquema actual', async () => {
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto());
      repositorioVersiones.create.mockReturnValue({ nombre: 'Versión 1' });
      repositorioVersiones.save.mockResolvedValue({ versionId: 10 });
      repositorioVersiones.findOneBy.mockResolvedValue(crearVersion());

      const resultado = await servicio.crear(1, 5, { nombre: '  Versión 1  ' });

      expect(persistenciaColaboracion.commit).toHaveBeenCalledWith('5');
      expect(repositorioVersiones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Versión 1',
          json: { nodeDataArray: [] },
        }),
      );
      expect(resultado.versionId).toBe(10);
    });

    it('lanza BadRequestException si el proyecto no tiene diagrama', async () => {
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(null));

      await expect(servicio.crear(1, 5, { nombre: 'Versión 1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repositorioVersiones.save).not.toHaveBeenCalled();
    });

    it('propaga ForbiddenException si no es el creador', async () => {
      proyectosService.verificarCreadorProyecto.mockRejectedValue(new ForbiddenException());

      await expect(servicio.crear(2, 5, { nombre: 'Versión 1' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(persistenciaColaboracion.commit).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('renombra la versión', async () => {
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      repositorioVersiones.findOneBy.mockResolvedValue(crearVersion());
      repositorioVersiones.save.mockResolvedValue(crearVersion());

      await servicio.actualizar(1, 5, 10, { nombre: 'Versión final' });

      expect(repositorioVersiones.save).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Versión final' }),
      );
      expect(persistenciaColaboracion.commit).not.toHaveBeenCalled();
    });

    it('sobrescribe el snapshot con el diagrama actual', async () => {
      const version = crearVersion();
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto({ nodeDataArray: [{ key: 1 }] }));
      repositorioVersiones.findOneBy.mockResolvedValue(version);
      repositorioVersiones.save.mockResolvedValue(version);

      await servicio.actualizar(1, 5, 10, { actualizarSnapshot: true });

      expect(persistenciaColaboracion.commit).toHaveBeenCalledWith('5');
      expect(version.json).toEqual({ nodeDataArray: [{ key: 1 }] });
    });

    it('lanza NotFoundException si la versión no pertenece al proyecto', async () => {
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      repositorioVersiones.findOneBy.mockResolvedValue(null);

      await expect(servicio.actualizar(1, 5, 99, { nombre: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('eliminar', () => {
    it('elimina la versión del proyecto', async () => {
      const version = crearVersion();
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      repositorioVersiones.findOneBy.mockResolvedValue(version);

      await servicio.eliminar(1, 5, 10);

      expect(repositorioVersiones.remove).toHaveBeenCalledWith(version);
    });
  });

  describe('restaurar', () => {
    it('aplica el json de la versión al proyecto', async () => {
      const version = crearVersion();
      proyectosService.verificarCreadorProyecto.mockResolvedValue(crearProyecto());
      repositorioVersiones.findOneBy.mockResolvedValue(version);
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(version.json));

      const resultado = await servicio.restaurar(1, 5, 10);

      expect(persistenciaColaboracion.restaurar).toHaveBeenCalledWith(5, version.json);
      expect(resultado.esquemaJson).toEqual(version.json);
    });
  });
});
