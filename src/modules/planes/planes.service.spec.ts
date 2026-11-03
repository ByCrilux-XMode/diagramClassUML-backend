import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlanesService } from './planes.service.js';
import type { Plane } from './plane.schema.js';

/** Cadena de consulta de mongoose (`sort().select().lean().exec()`). */
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

const plan = (version: number): Plane =>
  ({
    _id: `p${version}`,
    proyectoId: 7,
    version,
    contenido: `plan v${version}`,
    autorUsuarioId: 3,
    autorNombre: 'Ana Pérez',
    origen: 'ia',
    sustituyeA: version > 1 ? version - 1 : null,
    creadoEn: new Date('2026-10-31'),
  }) as Plane;

describe('PlanesService', () => {
  let modelo: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  let servicio: PlanesService;
  const autor = { usuarioId: 3, nombre: 'Ana Pérez' };

  beforeEach(() => {
    modelo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    };
    servicio = new PlanesService(modelo as never);
  });

  describe('crear', () => {
    it('la primera versión es la 1 y no sustituye a ninguna', async () => {
      modelo.findOne.mockReturnValue(cadena(null));
      modelo.create.mockResolvedValue(plan(1));

      const creado = await servicio.crear(7, { contenido: '  Acuerdo  ', origen: 'ia' }, autor);

      expect(creado.version).toBe(1);
      expect(creado.sustituyeA).toBeNull();
      expect(modelo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          proyectoId: 7,
          version: 1,
          contenido: 'Acuerdo',
          autorUsuarioId: 3,
          autorNombre: 'Ana Pérez',
          origen: 'ia',
        }),
      );
    });

    it('la versión siguiente continúa la numeración y marca sustituyeA', async () => {
      modelo.findOne.mockReturnValue(cadena({ version: 4 }));
      modelo.create.mockResolvedValue(plan(5));

      const creado = await servicio.crear(7, { contenido: 'nuevo', origen: 'humano' }, autor);

      expect(creado.version).toBe(5);
      expect(creado.sustituyeA).toBe(4);
    });

    it('reintenta cuando dos guardados simultáneos chocan por el índice único', async () => {
      modelo.findOne.mockReturnValue(cadena(null));
      modelo.create
        .mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000 }))
        .mockResolvedValueOnce(plan(1));

      const creado = await servicio.crear(7, { contenido: 'x', origen: 'ia' }, autor);

      expect(modelo.create).toHaveBeenCalledTimes(2);
      expect(creado.version).toBe(1);
    });

    it('no reintenta indefinidamente si la carrera no se resuelve', async () => {
      modelo.findOne.mockReturnValue(cadena(null));
      modelo.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

      await expect(servicio.crear(7, { contenido: 'x', origen: 'ia' }, autor)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(modelo.create).toHaveBeenCalledTimes(3);
    });

    it('rechaza un plan vacío', async () => {
      await expect(
        servicio.crear(7, { contenido: '   ', origen: 'ia' }, autor),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(modelo.create).not.toHaveBeenCalled();
    });

    it('propaga errores que no son de duplicado', async () => {
      modelo.findOne.mockReturnValue(cadena(null));
      modelo.create.mockRejectedValue(new Error('caída de red'));

      await expect(servicio.crear(7, { contenido: 'x', origen: 'ia' }, autor)).rejects.toThrow(
        'caída de red',
      );
    });
  });

  describe('consulta', () => {
    it('lista de la versión más nueva a la más vieja', async () => {
      modelo.find.mockReturnValue(cadena([plan(3), plan(2), plan(1)]));

      const planes = await servicio.listar(7, 3);

      expect(planes).toHaveLength(3);
      expect(modelo.find).toHaveBeenCalledWith({ proyectoId: 7 });
    });

    it('la versión vigente es la de número más alto', async () => {
      modelo.findOne.mockReturnValue(cadena(plan(9)));

      const vigente = await servicio.vigente(7);

      expect(vigente?.version).toBe(9);
    });

    it('un proyecto sin plan devuelve null', async () => {
      modelo.findOne.mockReturnValue(cadena(null));

      await expect(servicio.vigente(7)).resolves.toBeNull();
    });

    it('buscar una versión inexistente lanza NotFound', async () => {
      modelo.findOne.mockReturnValue(cadena(null));

      await expect(servicio.buscarVersion(7, 2)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminarPorProyecto', () => {
    it('borra los planes del proyecto y devuelve el total', async () => {
      modelo.deleteMany.mockReturnValue(cadena({ deletedCount: 3 }));

      await expect(servicio.eliminarPorProyecto(7)).resolves.toBe(3);
      expect(modelo.deleteMany).toHaveBeenCalledWith({ proyectoId: 7 });
    });
  });
});
