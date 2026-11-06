import { NotFoundException } from '@nestjs/common';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { VersionesService } from './versiones.service.js';

describe('VersionesService', () => {
  let servicio: VersionesService;
  const repositorioVersiones = {
    create: vi.fn(),
    save: vi.fn(),
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
  };

  const proyecto = {
    proyectoId: 5,
    nombre: 'Diagrama UML',
    esquemaJson: { clases: [] },
  } as Proyecto;
  const usuario = {
    usuarioId: 1,
    username: 'user1',
    persona: { personaId: 1, nombre: 'Juan', apellido: 'Pérez' },
  } as Usuario;

  beforeEach(() => {
    vi.clearAllMocks();
    repositorioVersiones.create.mockImplementation((entidad) => entidad);
    servicio = new VersionesService(repositorioVersiones as never);
  });

  describe('crear', () => {
    it('genera el nombre automáticamente y guarda el esquema actual del proyecto', async () => {
      repositorioVersiones.count.mockResolvedValue(2);
      repositorioVersiones.save.mockResolvedValue({ versionId: 9 });
      repositorioVersiones.findOne.mockResolvedValue({ versionId: 9, proyectoId: 5 });

      const resultado = await servicio.crear(proyecto, usuario, {
        descripcionPredeterminada: 'Guardado automático.',
      });

      expect(repositorioVersiones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          proyecto,
          creadoPor: usuario,
          nombre: 'Versión 3',
          descripcion: 'Guardado automático.',
          esquemaJson: { clases: [] },
        }),
      );
      expect(repositorioVersiones.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { versionId: 9, proyecto: { proyectoId: 5 } },
        }),
      );
      expect(resultado).toEqual({ versionId: 9, proyectoId: 5 });
    });

    it('respeta el nombre y la descripción indicados', async () => {
      repositorioVersiones.save.mockResolvedValue({ versionId: 10 });
      repositorioVersiones.findOne.mockResolvedValue({ versionId: 10, proyectoId: 5 });

      await servicio.crear(proyecto, usuario, {
        nombre: 'Entrega final',
        descripcion: 'Versión revisada',
        esquemaJson: { clases: ['A'] },
      });

      expect(repositorioVersiones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Entrega final',
          descripcion: 'Versión revisada',
          esquemaJson: { clases: ['A'] },
        }),
      );
    });
  });

  describe('listar', () => {
    it('devuelve las versiones del proyecto paginadas', async () => {
      repositorioVersiones.findAndCount.mockResolvedValue([[{ versionId: 1 }], 1]);

      const resultado = await servicio.listar(5, { pagina: 2, limite: 10 });

      expect(repositorioVersiones.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { proyecto: { proyectoId: 5 } },
          skip: 10,
          take: 10,
        }),
      );
      expect(resultado).toEqual({ datos: [{ versionId: 1 }], total: 1 });
    });
  });

  describe('buscarPorId', () => {
    it('devuelve la versión cuando pertenece al proyecto', async () => {
      repositorioVersiones.findOne.mockResolvedValue({ versionId: 1, proyectoId: 5 });

      await expect(servicio.buscarPorId(5, 1)).resolves.toEqual({ versionId: 1, proyectoId: 5 });
    });

    it('lanza NotFoundException cuando la versión no existe', async () => {
      repositorioVersiones.findOne.mockResolvedValue(null);

      await expect(servicio.buscarPorId(5, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
