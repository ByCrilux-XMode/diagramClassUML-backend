import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { PermisosService } from '../permisos/permisos.service.js';
import { Colaborador } from './colaborador.entity.js';
import { ColaboradoresService } from './colaboradores.service.js';

describe('ColaboradoresService', () => {
  let servicio: ColaboradoresService;
  const repositorioColaboradores = {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const proyectosService = { buscarPorId: vi.fn(), verificarPermisoLectura: vi.fn() };
  const usuariosService = { buscarPorId: vi.fn() };
  const permisosService = { buscarPorId: vi.fn() };

  const crearProyecto = (proyectoId: number, creadorId: number) =>
    ({ proyectoId, creador: { usuarioId: creadorId } });
  const crearColaborador = (usuarioId: number, proyectoId: number): Colaborador =>
    ({ usuarioId, proyectoId, permiso: { nombre: 'EDITOR' } } as Colaborador);

  beforeEach(() => {
    vi.clearAllMocks();
    servicio = new ColaboradoresService(
      repositorioColaboradores as never,
      proyectosService as never,
      usuariosService as never,
      permisosService as never,
    );
  });

  describe('asignar', () => {
    it('asigna nuevo colaborador al proyecto', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      usuariosService.buscarPorId.mockResolvedValue({ usuarioId: 3 });
      permisosService.buscarPorId.mockResolvedValue({ permisoId: 2, nombre: 'EDITOR' });
      repositorioColaboradores.findOneBy.mockResolvedValue(null);
      repositorioColaboradores.create.mockReturnValue({ usuarioId: 3, proyectoId: 5, permisoId: 2 });
      repositorioColaboradores.save.mockResolvedValue(crearColaborador(3, 5));
      repositorioColaboradores.findOne.mockResolvedValue(crearColaborador(3, 5));

      const resultado = await servicio.asignar(1, 5, { usuarioId: 3, permisoId: 2 });
      expect(resultado.usuarioId).toBe(3);
      expect(repositorioColaboradores.create).toHaveBeenCalled();
    });

    it('actualiza el permiso si el colaborador ya existe', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      usuariosService.buscarPorId.mockResolvedValue({ usuarioId: 3 });
      permisosService.buscarPorId.mockResolvedValue({ permisoId: 3, nombre: 'LECTOR' });
      repositorioColaboradores.findOneBy.mockResolvedValue({ usuarioId: 3, proyectoId: 5, permisoId: 2 });
      repositorioColaboradores.save.mockResolvedValue(crearColaborador(3, 5));
      repositorioColaboradores.findOne.mockResolvedValue(crearColaborador(3, 5));

      await servicio.asignar(1, 5, { usuarioId: 3, permisoId: 3 });
      expect(repositorioColaboradores.save).toHaveBeenCalled();
    });

    it('lanza ForbiddenException cuando el usuario no es creador del proyecto', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      await expect(servicio.asignar(2, 5, { usuarioId: 3, permisoId: 2 })).rejects.toBeInstanceOf(ForbiddenException);
      expect(usuariosService.buscarPorId).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException cuando el usuario a asignar no existe', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      usuariosService.buscarPorId.mockRejectedValue(new NotFoundException('Usuario no encontrado'));
      await expect(servicio.asignar(1, 5, { usuarioId: 99, permisoId: 2 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listarDelProyecto', () => {
    it('devuelve los colaboradores ordenados por usuarioId', async () => {
      proyectosService.verificarPermisoLectura.mockResolvedValue('CREADOR');
      repositorioColaboradores.find.mockResolvedValue([crearColaborador(2, 5), crearColaborador(3, 5)]);
      const resultado = await servicio.listarDelProyecto(1, 5);
      expect(resultado).toHaveLength(2);
    });

    it('un LECTOR puede listar los colaboradores del proyecto', async () => {
      proyectosService.verificarPermisoLectura.mockResolvedValue('LECTOR');
      repositorioColaboradores.find.mockResolvedValue([crearColaborador(3, 5)]);

      const resultado = await servicio.listarDelProyecto(9, 5);

      expect(resultado).toHaveLength(1);
      expect(proyectosService.verificarPermisoLectura).toHaveBeenCalledWith(9, 5);
      expect(proyectosService.buscarPorId).not.toHaveBeenCalled();
    });

    it('un ajeno recibe ForbiddenException al listar', async () => {
      proyectosService.verificarPermisoLectura.mockRejectedValue(
        new ForbiddenException('No tienes acceso a este proyecto'),
      );

      await expect(servicio.listarDelProyecto(99, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorioColaboradores.find).not.toHaveBeenCalled();
    });

    it('las mutaciones siguen siendo solo del creador', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));

      await expect(servicio.asignar(2, 5, { usuarioId: 3, permisoId: 2 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(servicio.actualizarPermiso(2, 5, 3, 3)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(servicio.remover(2, 5, 3)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('actualizarPermiso', () => {
    it('actualiza el permiso del colaborador', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      permisosService.buscarPorId.mockResolvedValue({ permisoId: 3, nombre: 'LECTOR' });
      repositorioColaboradores.findOne.mockResolvedValue(crearColaborador(3, 5));
      repositorioColaboradores.save.mockResolvedValue(crearColaborador(3, 5));
      const resultado = await servicio.actualizarPermiso(1, 5, 3, 3);
      expect(resultado.permiso.nombre).toBe('LECTOR');
    });
  });

  describe('remover', () => {
    it('elimina el colaborador cuando existe', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      repositorioColaboradores.findOne.mockResolvedValue(crearColaborador(3, 5));
      repositorioColaboradores.remove.mockResolvedValue(undefined);
      await servicio.remover(1, 5, 3);
      expect(repositorioColaboradores.remove).toHaveBeenCalled();
    });

    it('lanza NotFoundException cuando el colaborador no existe', async () => {
      proyectosService.buscarPorId.mockResolvedValue(crearProyecto(5, 1));
      repositorioColaboradores.findOne.mockResolvedValue(null);
      await expect(servicio.remover(1, 5, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
