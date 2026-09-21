import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Proyecto } from './proyecto.entity.js';
import { ProyectosService } from './proyectos.service.js';

describe('ProyectosService', () => {
  let servicio: ProyectosService;
  const repositorio = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    findAndCount: vi.fn(),
    remove: vi.fn(),
  };
  const repositorioColaboradores = {
    findOne: vi.fn(),
  };
  const usuariosService = { buscarPorId: vi.fn() };

  const crearProyecto = (creadorId: number): Proyecto =>
    ({ proyectoId: 5, nombre: 'Original', esquemaJson: null, creador: { usuarioId: creadorId } as Usuario }) as Proyecto;

  beforeEach(() => {
    vi.clearAllMocks();
    servicio = new ProyectosService(
      repositorio as never,
      repositorioColaboradores as never,
      usuariosService as never,
    );
  });

  describe('buscarPorId', () => {
    it('lanza NotFoundException cuando el proyecto no existe', async () => {
      repositorio.findOne.mockResolvedValue(null);

      await expect(servicio.buscarPorId(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('actualizar', () => {
    it('el creador puede actualizar el proyecto', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorio.save.mockResolvedValue(crearProyecto(1));

      const resultado = await servicio.actualizar(1, 5, { nombre: 'Cambiado' });

      expect(repositorio.save).toHaveBeenCalled();
      expect(resultado.nombre).toBe('Cambiado');
      expect(repositorioColaboradores.findOne).not.toHaveBeenCalled();
    });

    it('un colaborador EDITOR puede actualizar el proyecto', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorio.save.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'EDITOR' } });

      const resultado = await servicio.actualizar(3, 5, { esquemaJson: { campo: 'nuevo' } });

      expect(repositorio.save).toHaveBeenCalled();
      expect(resultado.esquemaJson).toEqual({ campo: 'nuevo' });
    });

    it('un colaborador LECTOR no puede actualizar el proyecto', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'LECTOR' } });

      await expect(servicio.actualizar(3, 5, { nombre: 'Cambio' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('un usuario sin registro de colaborador no puede actualizar el proyecto', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue(null);

      await expect(servicio.actualizar(2, 5, { nombre: 'Cambio' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorio.save).not.toHaveBeenCalled();
    });
  });

  describe('verificarMiembro', () => {
    it('devuelve CREADOR cuando el usuario creó el proyecto', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));

      const rol = await servicio.verificarMiembro(1, 5);

      expect(rol).toBe('CREADOR');
      expect(repositorioColaboradores.findOne).not.toHaveBeenCalled();
    });

    it('devuelve el nombre del permiso cuando es colaborador', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'EDITOR' } });

      const rol = await servicio.verificarMiembro(3, 5);

      expect(rol).toBe('EDITOR');
    });

    it('devuelve null cuando el usuario no es miembro', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue(null);

      await expect(servicio.verificarMiembro(2, 5)).resolves.toBeNull();
    });

    it('lanza NotFoundException cuando el proyecto no existe', async () => {
      repositorio.findOne.mockResolvedValue(null);

      await expect(servicio.verificarMiembro(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('verificarPermisoEscritura', () => {
    it('permite al creador', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));

      await expect(servicio.verificarPermisoEscritura(1, 5)).resolves.toBeDefined();
      expect(repositorioColaboradores.findOne).not.toHaveBeenCalled();
    });

    it('permite a un colaborador EDITOR', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'EDITOR' } });

      await expect(servicio.verificarPermisoEscritura(3, 5)).resolves.toBeDefined();
    });

    it('niega el acceso a un colaborador LECTOR', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'LECTOR' } });

      await expect(servicio.verificarPermisoEscritura(3, 5)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('eliminar', () => {
    it('lanza ForbiddenException cuando quien elimina no es el creador aunque sea colaborador', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'EDITOR' } });

      await expect(servicio.eliminar(3, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorio.remove).not.toHaveBeenCalled();
    });

    it('el creador puede eliminar el proyecto', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorio.remove.mockResolvedValue(crearProyecto(1));

      await servicio.eliminar(1, 5);

      expect(repositorio.remove).toHaveBeenCalled();
    });
  });
});