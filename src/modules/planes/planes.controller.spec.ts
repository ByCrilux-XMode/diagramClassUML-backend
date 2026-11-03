import { ForbiddenException } from '@nestjs/common';
import { PlanesController } from './planes.controller.js';

describe('PlanesController', () => {
  const planesService = { crear: vi.fn(), listar: vi.fn(), vigente: vi.fn(), buscarVersion: vi.fn() };
  const proyectosService = {
    verificarPermisoEscritura: vi.fn(),
    verificarPermisoLectura: vi.fn(),
  };
  const controller = new PlanesController(planesService as never, proyectosService as never);
  const usuario = { usuarioId: 3, username: 'ana', persona: { nombre: 'Ana', apellido: 'Pérez' } } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    planesService.crear.mockResolvedValue({ version: 1 });
    planesService.listar.mockResolvedValue([]);
    planesService.vigente.mockResolvedValue(null);
    proyectosService.verificarPermisoLectura.mockResolvedValue('EDITOR');
  });

  it('guardar exige permiso de escritura', async () => {
    proyectosService.verificarPermisoEscritura.mockResolvedValue({});

    await controller.crear(usuario, 7, { contenido: 'plan', origen: 'ia' });

    expect(proyectosService.verificarPermisoEscritura).toHaveBeenCalledWith(3, 7);
    expect(planesService.crear).toHaveBeenCalledWith(
      7,
      { contenido: 'plan', origen: 'ia' },
      { usuarioId: 3, nombre: 'Ana Pérez' },
    );
  });

  it('un LECTOR recibe 403 y no se guarda nada', async () => {
    proyectosService.verificarPermisoEscritura.mockRejectedValue(
      new ForbiddenException('No tienes permiso para modificar este proyecto'),
    );

    await expect(
      controller.crear(usuario, 7, { contenido: 'plan', origen: 'ia' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(planesService.crear).not.toHaveBeenCalled();
  });

  it('cualquier colaborador puede leer los planes', async () => {
    proyectosService.verificarPermisoLectura.mockResolvedValue('LECTOR');

    await controller.listar(usuario, 7, { limite: 10 });

    expect(proyectosService.verificarPermisoLectura).toHaveBeenCalledWith(3, 7);
    expect(proyectosService.verificarPermisoEscritura).not.toHaveBeenCalled();
  });

  it('leer también exige ser colaborador', async () => {
    proyectosService.verificarPermisoLectura.mockRejectedValue(new ForbiddenException());

    await expect(controller.listar(usuario, 7, { limite: 10 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(planesService.listar).not.toHaveBeenCalled();
  });
});
