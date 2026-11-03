import { BadRequestException } from '@nestjs/common';
import { CADENAS_POR_DEFECTO, ConfigIaService, parsearCadena } from './config-ia.service.js';
import type { CadenasConfig, ConfigIa } from './config-ia.schema.js';

function cadena<T>(valor: T) {
  const c: Record<string, unknown> = {};
  const paso = () => c;
  c.sort = paso;
  c.select = paso;
  c.limit = paso;
  c.lean = paso;
  c.exec = () => Promise.resolve(valor);
  return c;
}

function config(
  cadenas: CadenasConfig = CADENAS_POR_DEFECTO,
  cambios: Partial<ConfigIa> = {},
): ConfigIa {
  return {
    proyectoId: 7,
    proveedor: 'openrouter',
    modelo: 'modelo/x',
    cadenas,
    actualizadoPor: { usuarioId: 3, nombre: 'Ana Pérez' },
    actualizadoEn: new Date('2026-11-01'),
    ...cambios,
  } as ConfigIa;
}

describe('parsearCadena', () => {
  it('parsea proveedor y modelo separados por dos puntos', () => {
    expect(parsearCadena('openrouter:modelo/x,hf-space')).toEqual([
      { proveedor: 'openrouter', modelo: 'modelo/x' },
      { proveedor: 'hf-space', modelo: null },
    ]);
  });

  it('una cadena vacía no produce tramos', () => {
    expect(parsearCadena('   ')).toEqual([]);
  });

  it('rechaza Ollama con un error de configuración explícito', () => {
    expect(() => parsearCadena('ollama:qwen2.5-coder:7b')).toThrow(BadRequestException);
    expect(() => parsearCadena('ollama:qwen2.5-coder:7b')).toThrow(/Ollama no forma parte/);
  });

  it('rechaza proveedores desconocidos', () => {
    expect(() => parsearCadena('anthropic')).toThrow(/Proveedor no permitido/);
  });
});

describe('ConfigIaService', () => {
  let modelo: {
    findOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  let validador: { modelosDe: ReturnType<typeof vi.fn> };
  let servicio: ConfigIaService;
  const autor = { usuarioId: 3, nombre: 'Ana Pérez' };

  beforeEach(() => {
    modelo = {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteMany: vi.fn(),
    };
    validador = { modelosDe: vi.fn().mockResolvedValue(null) };
    servicio = new ConfigIaService(modelo as never, validador as never);
  });

  it('un proyecto sin documento recibe los defaults efectivos', async () => {
    modelo.findOne.mockReturnValue(cadena(null));

    const configuracion = await servicio.obtener(7);

    expect(configuracion.porDefecto).toBe(true);
    expect(configuracion.actualizadoPor).toBeNull();
    expect(configuracion.cadenas.edicion[0]?.proveedor).toBe('openrouter');
    expect(configuracion.cadenas.consulta[0]?.proveedor).toBe('hf-space');
    expect(configuracion.cadenas.resumen[0]?.proveedor).toBe('hf-space');
  });

  it('un documento guardado se devuelve como configuración vigente', async () => {
    modelo.findOne.mockReturnValue(cadena(config()));

    const configuracion = await servicio.obtener(7);

    expect(configuracion.porDefecto).toBe(false);
    expect(configuracion.proveedor).toBe('openrouter');
    expect(configuracion.modelo).toBe('modelo/x');
    expect(configuracion.actualizadoPor?.nombre).toBe('Ana Pérez');
  });

  it('actualizar registra autor, fecha y conserva las cadenas no enviadas', async () => {
    modelo.findOne.mockReturnValue(cadena(null));
    modelo.findOneAndUpdate.mockReturnValue(
      cadena(
        config(
          {
            ...CADENAS_POR_DEFECTO,
            edicion: [{ proveedor: 'hf-space', modelo: 'otro/modelo' }],
          },
          { proveedor: 'hf-space', modelo: 'otro/modelo' },
        ),
      ),
    );

    const configuracion = await servicio.actualizar(
      7,
      {
        proveedor: 'hf-space',
        modelo: 'otro/modelo',
        cadenas: { edicion: [{ proveedor: 'hf-space', modelo: 'otro/modelo' }] },
      },
      autor,
    );

    expect(configuracion.cadenas.edicion).toEqual([
      { proveedor: 'hf-space', modelo: 'otro/modelo' },
    ]);
    expect(configuracion.cadenas.consulta[0]?.proveedor).toBe('hf-space');
    const cambios = modelo.findOneAndUpdate.mock.calls[0][1] as {
      $set: { actualizadoPor: unknown; actualizadoEn: Date; proyectoId: number };
    };
    expect(cambios.$set.actualizadoPor).toEqual(autor);
    expect(cambios.$set.actualizadoEn).toBeInstanceOf(Date);
    expect(cambios.$set.proyectoId).toBe(7);
  });

  it('rechaza una cadena vacía sin tocar la base', async () => {
    modelo.findOne.mockReturnValue(cadena(null));

    await expect(
      servicio.actualizar(7, { cadenas: { edicion: [] } }, autor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(modelo.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza Ollama y proveedores desconocidos al actualizar', async () => {
    modelo.findOne.mockReturnValue(cadena(null));

    await expect(
      servicio.actualizar(
        7,
        { cadenas: { edicion: [{ proveedor: 'ollama' as never }] } },
        autor,
      ),
    ).rejects.toThrow(/Proveedor no permitido/);
    await expect(
      servicio.actualizar(
        7,
        { cadenas: { consulta: [{ proveedor: 'anthropic' as never }] } },
        autor,
      ),
    ).rejects.toThrow(/Proveedor no permitido/);
  });

  it('si el proveedor no responde, guarda sin bloquear', async () => {
    modelo.findOne.mockReturnValue(cadena(null));
    validador.modelosDe.mockResolvedValue(null);
    modelo.findOneAndUpdate.mockReturnValue(
      cadena(config(CADENAS_POR_DEFECTO, { modelo: 'modelo/desconocido' })),
    );

    await expect(
      servicio.actualizar(7, { modelo: 'modelo/desconocido' }, autor),
    ).resolves.toBeDefined();
    expect(validador.modelosDe).toHaveBeenCalledWith('openrouter');
  });

  it('rechaza un modelo que el catálogo del proveedor no incluye', async () => {
    modelo.findOne.mockReturnValue(cadena(null));
    validador.modelosDe.mockResolvedValue(['modelo/valido']);

    await expect(
      servicio.actualizar(7, { modelo: 'modelo/inexistente' }, autor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(modelo.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('acepta un modelo presente en el catálogo', async () => {
    modelo.findOne.mockReturnValue(cadena(null));
    validador.modelosDe.mockResolvedValue(['modelo/valido']);
    modelo.findOneAndUpdate.mockReturnValue(
      cadena(config(CADENAS_POR_DEFECTO, { modelo: 'modelo/valido' })),
    );

    await expect(servicio.actualizar(7, { modelo: 'modelo/valido' }, autor)).resolves.toBeDefined();
  });

  it('borrar el proyecto elimina su configuración', async () => {
    modelo.deleteMany.mockReturnValue(cadena({ deletedCount: 1 }));

    await expect(servicio.eliminarPorProyecto(7)).resolves.toBe(1);
    expect(modelo.deleteMany).toHaveBeenCalledWith({ proyectoId: 7 });
  });
});
