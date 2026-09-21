import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ColaboracionService } from './colaboracion.service.js';
import { PersistenciaColaboracionService } from './persistencia-colaboracion.service.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';

describe('ColaboracionService', () => {
  let servicio: ColaboracionService;
  const proyectosService = {
    verificarPermisoEscritura: vi.fn(),
    buscarPorId: vi.fn(),
  };
  const persistenciaService = { commit: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    servicio = new ColaboracionService(
      proyectosService as unknown as ProyectosService,
      persistenciaService as unknown as PersistenciaColaboracionService,
    );
  });

  it('guarda el proyecto cuando el usuario tiene permiso de escritura', async () => {
    proyectosService.verificarPermisoEscritura.mockResolvedValue({ proyectoId: 5 });
    proyectosService.buscarPorId.mockResolvedValue({ proyectoId: 5, nombre: 'Diagrama' });

    const resultado = await servicio.guardar(1, 5);

    expect(persistenciaService.commit).toHaveBeenCalledWith('5');
    expect(resultado).toEqual({ proyectoId: 5, nombre: 'Diagrama' });
  });

  it('no concreta si el usuario no tiene permiso de escritura', async () => {
    proyectosService.verificarPermisoEscritura.mockRejectedValue(new ForbiddenException());

    await expect(servicio.guardar(3, 5)).rejects.toBeInstanceOf(ForbiddenException);
    expect(persistenciaService.commit).not.toHaveBeenCalled();
  });

  it('propaga NotFoundException cuando el proyecto no existe', async () => {
    proyectosService.verificarPermisoEscritura.mockRejectedValue(new NotFoundException());

    await expect(servicio.guardar(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(persistenciaService.commit).not.toHaveBeenCalled();
  });
});