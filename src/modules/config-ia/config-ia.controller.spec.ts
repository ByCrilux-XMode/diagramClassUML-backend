import { ForbiddenException } from '@nestjs/common';
import { ConfigIaController } from './config-ia.controller.js';
import { ConfigIaService } from './config-ia.service.js';
import { ProyectosService } from '../proyectos/proyectos.service.js';
import type { Usuario } from '../usuarios/usuario.entity.js';

const usuario = {
  usuarioId: 3,
  username: 'ana',
  persona: { nombre: 'Ana', apellido: 'Pérez' },
} as Usuario;

const configuracion = {
  proyectoId: 7,
  proveedor: 'openrouter' as const,
  modelo: null,
  cadenas: {
    edicion: [{ proveedor: 'openrouter' as const, modelo: null }],
    consulta: [{ proveedor: 'hf-space' as const, modelo: null }],
    resumen: [{ proveedor: 'hf-space' as const, modelo: null }],
  },
  actualizadoPor: null,
  actualizadoEn: null,
  porDefecto: true,
};

describe('ConfigIaController', () => {
  let servicio: { obtener: ReturnType<typeof vi.fn>; actualizar: ReturnType<typeof vi.fn> };
  let proyectos: {
    verificarPermisoLectura: ReturnType<typeof vi.fn>;
    verificarCreadorProyecto: ReturnType<typeof vi.fn>;
  };
  let controlador: ConfigIaController;

  beforeEach(() => {
    servicio = {
      obtener: vi.fn().mockResolvedValue(configuracion),
      actualizar: vi.fn().mockResolvedValue({ ...configuracion, porDefecto: false }),
    };
    proyectos = {
      verificarPermisoLectura: vi.fn().mockResolvedValue('LECTOR'),
      verificarCreadorProyecto: vi.fn().mockResolvedValue({ proyectoId: 7 }),
    };
    controlador = new ConfigIaController(
      servicio as unknown as ConfigIaService,
      proyectos as unknown as ProyectosService,
    );
  });

  it('cualquier colaborador lee la configuración efectiva', async () => {
    const respuesta = await controlador.obtener(usuario, 7);

    expect(proyectos.verificarPermisoLectura).toHaveBeenCalledWith(3, 7);
    expect(respuesta.config.porDefecto).toBe(true);
  });

  it('un ajeno recibe el 403 del servicio de proyectos', async () => {
    proyectos.verificarPermisoLectura.mockRejectedValue(new ForbiddenException());

    await expect(controlador.obtener(usuario, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(servicio.obtener).not.toHaveBeenCalled();
  });

  it('solo el CREADOR actualiza la configuración', async () => {
    const respuesta = await controlador.actualizar(usuario, 7, { modelo: 'modelo/x' });

    expect(proyectos.verificarCreadorProyecto).toHaveBeenCalledWith(3, 7);
    expect(servicio.actualizar).toHaveBeenCalledWith(
      7,
      { modelo: 'modelo/x' },
      { usuarioId: 3, nombre: 'Ana Pérez' },
    );
    expect(respuesta.config.porDefecto).toBe(false);
  });

  it('un EDITOR recibe 403 antes de escribir', async () => {
    proyectos.verificarCreadorProyecto.mockRejectedValue(new ForbiddenException());

    await expect(
      controlador.actualizar(usuario, 7, { proveedor: 'hf-space' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(servicio.actualizar).not.toHaveBeenCalled();
  });
});
