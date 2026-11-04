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
  const versionesService = {
    crear: vi.fn(),
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    eliminar: vi.fn(),
  };
  const notificacionesService = { notificarAccionProyecto: vi.fn() };
  const persistenciaColaboracionService = { aplicarEsquema: vi.fn() };

  const crearProyecto = (creadorId: number): Proyecto =>
    ({ proyectoId: 5, nombre: 'Original', esquemaJson: null, creador: { usuarioId: creadorId } as Usuario }) as Proyecto;

  beforeEach(() => {
    vi.clearAllMocks();
    usuariosService.buscarPorId.mockResolvedValue({
      usuarioId: 3,
      username: 'user3',
      persona: { personaId: 3, nombre: 'Carlos', apellido: 'López' },
    } as Usuario);
    versionesService.crear.mockResolvedValue({ versionId: 1 });
    servicio = new ProyectosService(
      repositorio as never,
      repositorioColaboradores as never,
      usuariosService as never,
      versionesService as never,
      notificacionesService as never,
      persistenciaColaboracionService as never,
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
      expect(versionesService.crear).toHaveBeenCalled();
      expect(notificacionesService.notificarAccionProyecto).toHaveBeenCalledWith(
        'PROYECTO_GUARDADO',
        expect.objectContaining({ proyectoId: 5 }),
        expect.objectContaining({ usuarioId: 3 }),
      );
    });

    it('no crea versión ni notifica cuando solo cambia el nombre', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorio.save.mockResolvedValue(crearProyecto(1));

      await servicio.actualizar(1, 5, { nombre: 'Cambiado' });

      expect(versionesService.crear).not.toHaveBeenCalled();
      expect(notificacionesService.notificarAccionProyecto).not.toHaveBeenCalled();
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

  describe('registrarGuardado', () => {
    it('crea una versión automática y notifica a los miembros', async () => {
      const proyecto = crearProyecto(1);
      repositorio.findOne.mockResolvedValue(proyecto);

      await servicio.registrarGuardado(3, 5);

      expect(versionesService.crear).toHaveBeenCalledWith(
        proyecto,
        expect.objectContaining({ usuarioId: 3 }),
        expect.objectContaining({ descripcionPredeterminada: expect.stringContaining('Carlos López') }),
      );
      expect(notificacionesService.notificarAccionProyecto).toHaveBeenCalledWith(
        'PROYECTO_GUARDADO',
        proyecto,
        expect.objectContaining({ usuarioId: 3 }),
      );
    });
  });

  describe('restaurarVersion', () => {
    it('restaura el esquema, crea una nueva versión y notifica', async () => {
      const proyecto = crearProyecto(1);
      repositorio.findOne.mockResolvedValue(proyecto);
      usuariosService.buscarPorId.mockResolvedValue({
        usuarioId: 1,
        username: 'user1',
        persona: { personaId: 1, nombre: 'Juan', apellido: 'Pérez' },
      } as Usuario);
      versionesService.buscarPorId.mockResolvedValue({
        versionId: 8,
        nombre: 'Versión 2',
        esquemaJson: { restaurado: true },
      });

      const resultado = await servicio.restaurarVersion(1, 5, 8);

      expect(versionesService.buscarPorId).toHaveBeenCalledWith(5, 8);
      expect(persistenciaColaboracionService.aplicarEsquema).toHaveBeenCalledWith(5, {
        restaurado: true,
      });
      expect(repositorio.save).toHaveBeenCalledWith(
        expect.objectContaining({ esquemaJson: { restaurado: true } }),
      );
      expect(versionesService.crear).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ usuarioId: 1 }),
        expect.objectContaining({ nombre: 'Restauración de Versión 2' }),
      );
      expect(notificacionesService.notificarAccionProyecto).toHaveBeenCalledWith(
        'VERSION_RESTAURADA',
        expect.anything(),
        expect.objectContaining({ usuarioId: 1 }),
        { versionId: 8, nombreVersion: 'Versión 2' },
      );
      expect(resultado.proyectoId).toBe(5);
    });

    it('no restaura si el usuario no tiene permiso de escritura', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'LECTOR' } });

      await expect(servicio.restaurarVersion(3, 5, 8)).rejects.toBeInstanceOf(ForbiddenException);
      expect(versionesService.buscarPorId).not.toHaveBeenCalled();
    });
  });

  describe('crearVersion', () => {
    it('crea una versión manual con el permiso de escritura', async () => {
      const proyecto = crearProyecto(1);
      repositorio.findOne.mockResolvedValue(proyecto);
      const dto = { nombre: 'Entrega final', descripcion: 'Versión revisada' };

      const resultado = await servicio.crearVersion(1, 5, dto);

      expect(versionesService.crear).toHaveBeenCalledWith(proyecto, expect.anything(), dto);
      expect(resultado).toEqual({ versionId: 1 });
    });
  });

  describe('eliminarVersion', () => {
    it('el creador puede eliminar una versión', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));

      await servicio.eliminarVersion(1, 5, 8);

      expect(versionesService.eliminar).toHaveBeenCalledWith(5, 8);
    });

    it('un colaborador EDITOR puede eliminar una versión', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'EDITOR' } });

      await servicio.eliminarVersion(3, 5, 8);

      expect(versionesService.eliminar).toHaveBeenCalledWith(5, 8);
    });

    it('un colaborador LECTOR no puede eliminar una versión', async () => {
      repositorio.findOne.mockResolvedValue(crearProyecto(1));
      repositorioColaboradores.findOne.mockResolvedValue({ permiso: { nombre: 'LECTOR' } });

      await expect(servicio.eliminarVersion(3, 5, 8)).rejects.toBeInstanceOf(ForbiddenException);
      expect(versionesService.eliminar).not.toHaveBeenCalled();
    });
  });
});