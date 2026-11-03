import { ForbiddenException } from '@nestjs/common';
import { TurnosController } from './turnos.controller.js';

describe('TurnosController', () => {
  const turnosService = { reclamar: vi.fn(), cerrar: vi.fn() };
  const proyectosService = {
    verificarPermisoEscritura: vi.fn(),
    verificarPermisoLectura: vi.fn(),
  };
  const controller = new TurnosController(turnosService as never, proyectosService as never);
  const usuario = { usuarioId: 3, username: 'ana', persona: { nombre: 'Ana', apellido: 'Pérez' } } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    proyectosService.verificarPermisoEscritura.mockResolvedValue({});
    proyectosService.verificarPermisoLectura.mockResolvedValue('LECTOR');
    turnosService.reclamar.mockResolvedValue({ turno: { _id: 't1' }, arriendoLiberado: false });
    turnosService.cerrar.mockResolvedValue({ _id: 't1' });
  });

  it('un turno en modo build exige permiso de escritura', async () => {
    await controller.reclamar(usuario, 7, { modo: 'build' });

    expect(proyectosService.verificarPermisoEscritura).toHaveBeenCalledWith(3, 7);
    expect(proyectosService.verificarPermisoLectura).not.toHaveBeenCalled();
    expect(turnosService.reclamar).toHaveBeenCalled();
  });

  it('un LECTOR no puede reclamar un turno de edición', async () => {
    proyectosService.verificarPermisoEscritura.mockRejectedValue(
      new ForbiddenException('No tienes permiso para modificar este proyecto'),
    );

    await expect(controller.reclamar(usuario, 7, { modo: 'build' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(turnosService.reclamar).not.toHaveBeenCalled();
  });

  it('un turno en modo plan solo pide ser colaborador', async () => {
    proyectosService.verificarPermisoLectura.mockResolvedValue('LECTOR');

    await controller.reclamar(usuario, 7, { modo: 'plan' });

    expect(proyectosService.verificarPermisoLectura).toHaveBeenCalledWith(3, 7);
    expect(proyectosService.verificarPermisoEscritura).not.toHaveBeenCalled();
    expect(turnosService.reclamar).toHaveBeenCalledWith(
      7,
      { modo: 'plan' },
      { usuarioId: 3, nombre: 'Ana Pérez' },
    );
  });

  it('un usuario ajeno al proyecto no reclama turno', async () => {
    proyectosService.verificarPermisoLectura.mockRejectedValue(new ForbiddenException());

    await expect(controller.reclamar(usuario, 7, { modo: 'plan' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(turnosService.reclamar).not.toHaveBeenCalled();
  });

  it('cerrar el turno también exige ser colaborador', async () => {
    await controller.cerrar(usuario, 7, 't1', { estado: 'listo' });

    expect(proyectosService.verificarPermisoLectura).toHaveBeenCalledWith(3, 7);
    expect(turnosService.cerrar).toHaveBeenCalledWith(
      7,
      't1',
      { estado: 'listo' },
      { usuarioId: 3, nombre: 'Ana Pérez' },
    );
  });
});
