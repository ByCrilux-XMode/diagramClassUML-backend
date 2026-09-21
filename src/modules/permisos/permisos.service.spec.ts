import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Permiso } from './permiso.entity.js';
import { Colaborador } from '../colaboradores/colaborador.entity.js';
import { PermisosService } from './permisos.service.js';

describe('PermisosService', () => {
  let servicio: PermisosService;
  const repositorioPermisos = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    countBy: vi.fn(),
  };
  const dataSource = {
    getRepository: vi.fn(),
    countBy: vi.fn(),
  };

  const crearPermiso = (permisoId: number, nombre: string): Permiso =>
    ({ permisoId, nombre } as Permiso);

  beforeEach(() => {
    vi.clearAllMocks();
    dataSource.getRepository.mockReturnValue({ countBy: vi.fn() });
    servicio = new PermisosService(
      repositorioPermisos as never,
      dataSource as never,
    );
  });

  describe('crear', () => {
    it('crea un permiso', async () => {
      repositorioPermisos.save.mockResolvedValue(crearPermiso(1, 'EDITOR'));
      const resultado = await servicio.crear('EDITOR');
      expect(resultado.nombre).toBe('EDITOR');
      expect(repositorioPermisos.save).toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('devuelve la lista de permisos ordenada', async () => {
      repositorioPermisos.find.mockResolvedValue([crearPermiso(1, 'LECTOR'), crearPermiso(2, 'EDITOR')]);
      const resultado = await servicio.listar();
      expect(resultado).toHaveLength(2);
    });
  });

  describe('buscarPorId', () => {
    it('devuelve el permiso cuando existe', async () => {
      repositorioPermisos.findOneBy.mockResolvedValue(crearPermiso(1, 'EDITOR'));
      const resultado = await servicio.buscarPorId(1);
      expect(resultado.nombre).toBe('EDITOR');
    });

    it('lanza NotFoundException cuando el permiso no existe', async () => {
      repositorioPermisos.findOneBy.mockResolvedValue(null);
      await expect(servicio.buscarPorId(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminar', () => {
    it('elimina el permiso cuando no está asignado a ningún colaborador', async () => {
      dataSource.getRepository().countBy.mockResolvedValue(0);
      repositorioPermisos.findOneBy.mockResolvedValue(crearPermiso(1, 'EDITOR'));
      repositorioPermisos.remove.mockResolvedValue(undefined);
      await servicio.eliminar(1);
      expect(repositorioPermisos.remove).toHaveBeenCalled();
    });

    it('lanza ConflictException cuando el permiso está asignado a colaborador(es)', async () => {
      dataSource.getRepository().countBy.mockResolvedValue(2);
      repositorioPermisos.findOneBy.mockResolvedValue(crearPermiso(1, 'EDITOR'));
      await expect(servicio.eliminar(1)).rejects.toBeInstanceOf(ConflictException);
      expect(repositorioPermisos.remove).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException cuando el permiso no existe', async () => {
      repositorioPermisos.findOneBy.mockResolvedValue(null);
      await expect(servicio.eliminar(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
