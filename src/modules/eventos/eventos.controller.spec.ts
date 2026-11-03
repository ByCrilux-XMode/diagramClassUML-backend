import { ForbiddenException } from '@nestjs/common';
import type { Usuario } from '../usuarios/usuario.entity.js';
import { EventosController } from './eventos.controller.js';
import type { ResultadoUltimoTurnoIA } from './eventos.service.js';

/**
 * La elegibilidad de la reversión es una operación de escritura: solo el
 * CREADOR o un EDITOR puede consultarla. Un LECTOR o un ajeno deben recibir 403
 * aunque la bitácora sea legible para ellos.
 */
describe('EventosController.ultimoTurnoIA', () => {
  const resultado: ResultadoUltimoTurnoIA = {
    turnoId: 'turno-ia',
    eventos: [],
    deshacible: true,
    entidades: ['clase:pedido'],
  };

  function crearControlador(permiso: {
    escritura?: () => Promise<unknown>;
    lectura?: () => Promise<unknown>;
  } = {}) {
    const eventosService = {
      ultimoTurnoIA: vi.fn().mockResolvedValue(resultado),
      listar: vi.fn(),
      registrarLote: vi.fn(),
    };
    const proyectosService = {
      verificarPermisoEscritura:
        permiso.escritura ?? vi.fn().mockResolvedValue({ proyectoId: 7 }),
      verificarPermisoLectura:
        permiso.lectura ?? vi.fn().mockResolvedValue('CREADOR'),
    };
    return {
      controlador: new EventosController(
        eventosService as never,
        proyectosService as never,
      ),
      eventosService,
      proyectosService,
    };
  }

  const usuario = { usuarioId: 1, username: 'ana' } as Usuario;

  it('un LECTOR recibe 403 y no consulta la reversión', async () => {
    const { controlador, eventosService } = crearControlador({
      escritura: () =>
        Promise.reject(
          new ForbiddenException('No tienes permiso para modificar este proyecto'),
        ),
    });

    await expect(controlador.ultimoTurnoIA(usuario, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(eventosService.ultimoTurnoIA).not.toHaveBeenCalled();
  });

  it('un usuario ajeno recibe 403 sin tocar los eventos', async () => {
    const { controlador, eventosService } = crearControlador({
      escritura: () => Promise.reject(new ForbiddenException('No tienes acceso')),
    });

    await expect(controlador.ultimoTurnoIA(usuario, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(eventosService.ultimoTurnoIA).not.toHaveBeenCalled();
  });

  it('el CREADOR obtiene el turno y su elegibilidad', async () => {
    const { controlador, eventosService, proyectosService } = crearControlador();

    await expect(controlador.ultimoTurnoIA(usuario, 7)).resolves.toEqual(resultado);

    expect(proyectosService.verificarPermisoEscritura).toHaveBeenCalledWith(1, 7);
    expect(eventosService.ultimoTurnoIA).toHaveBeenCalledWith(7);
  });

  it('un EDITOR también puede consultar y deshacer', async () => {
    const { controlador, eventosService } = crearControlador({
      escritura: vi.fn().mockResolvedValue({ proyectoId: 7 }),
    });

    await controlador.ultimoTurnoIA(usuario, 7);

    expect(eventosService.ultimoTurnoIA).toHaveBeenCalledWith(7);
  });
});
