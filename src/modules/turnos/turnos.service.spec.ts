import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ARRIENDO_TURNO_MS, TurnosService } from './turnos.service.js';
import type { TurnoIA } from './turno.schema.js';

/** Cadena de consulta de mongoose (`findOne().lean().exec()`). */
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

function turnoActivo(iniciadoEn: Date): TurnoIA {
  return {
    _id: '653f000000000000000000aa',
    proyectoId: 7,
    activo: true,
    estado: 'corriendo',
    modo: 'build',
    iniciadoPor: { usuarioId: 3, nombre: 'Ana Pérez' },
    iniciadoEn,
    terminadoEn: null,
    arriendo: false,
  } as unknown as TurnoIA;
}

const duplicado = () => Object.assign(new Error('E11000'), { code: 11000 });

describe('TurnosService', () => {
  let modelo: {
    create: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    updateOne: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  let servicio: TurnosService;
  const autor = { usuarioId: 3, nombre: 'Ana Pérez' };
  const dto = { modo: 'build' as const };

  beforeEach(() => {
    modelo = {
      create: vi.fn(),
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn(),
      deleteMany: vi.fn(),
    };
    servicio = new TurnosService(modelo as never);
  });

  describe('reclamar', () => {
    it('crea el turno activo del proyecto', async () => {
      modelo.create.mockResolvedValue(turnoActivo(new Date()));

      const { turno, arriendoLiberado } = await servicio.reclamar(7, dto, autor);

      expect(turno.activo).toBe(true);
      expect(turno.estado).toBe('corriendo');
      expect(turno.modo).toBe('build');
      expect(turno.iniciadoPor.usuarioId).toBe(3);
      expect(arriendoLiberado).toBe(false);
      expect(modelo.create).toHaveBeenCalledWith(
        expect.objectContaining({ proyectoId: 7, activo: true, modo: 'build' }),
      );
    });

    it('con otro turno activo responde con conflicto y sus datos', async () => {
      const activo = turnoActivo(new Date());
      modelo.create.mockRejectedValue(duplicado());
      modelo.findOne.mockReturnValue(cadena(activo));

      await expect(servicio.reclamar(7, dto, autor)).rejects.toBeInstanceOf(ConflictException);
      // No intenta liberar: el arriendo no venció.
      expect(modelo.updateOne).not.toHaveBeenCalled();
      expect(modelo.create).toHaveBeenCalledTimes(1);
    });

    it('libera un turno con el arriendo vencido y reclama otro', async () => {
      const vencido = turnoActivo(new Date(Date.now() - ARRIENDO_TURNO_MS - 1000));
      modelo.create.mockRejectedValueOnce(duplicado()).mockResolvedValueOnce(turnoActivo(new Date()));
      modelo.findOne.mockReturnValue(cadena(vencido));
      modelo.updateOne.mockReturnValue(cadena({ modifiedCount: 1 }));

      const { turno, arriendoLiberado } = await servicio.reclamar(7, dto, autor);

      expect(arriendoLiberado).toBe(true);
      expect(turno.activo).toBe(true);
      expect(modelo.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ activo: true }),
        expect.objectContaining({
          $set: expect.objectContaining({ activo: false, arriendo: true }),
        }),
      );
      expect(modelo.create).toHaveBeenCalledTimes(2);
    });

    it('si el turno en curso desaparece, reintenta en vez de fallar', async () => {
      modelo.create.mockRejectedValueOnce(duplicado()).mockResolvedValueOnce(turnoActivo(new Date()));
      modelo.findOne.mockReturnValue(cadena(null));

      const { arriendoLiberado } = await servicio.reclamar(7, dto, autor);

      expect(arriendoLiberado).toBe(false);
      expect(modelo.create).toHaveBeenCalledTimes(2);
    });

    it('propaga errores que no son de índice único', async () => {
      modelo.create.mockRejectedValue(new Error('caída de red'));

      await expect(servicio.reclamar(7, dto, autor)).rejects.toThrow('caída de red');
    });
  });

  describe('cerrar', () => {
    const id = '653f000000000000000000aa';

    it('cierra el turno que reclamó la misma persona', async () => {
      modelo.findOneAndUpdate.mockReturnValue(
        cadena({ ...turnoActivo(new Date()), activo: false, estado: 'listo' }),
      );

      const turno = await servicio.cerrar(7, id, { estado: 'listo' }, autor);

      expect(turno.estado).toBe('listo');
      expect(modelo.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ activo: true, 'iniciadoPor.usuarioId': 3 }),
        expect.objectContaining({ $set: expect.objectContaining({ activo: false }) }),
        { new: true },
      );
    });

    it('otra persona no puede reportar el cierre', async () => {
      modelo.findOneAndUpdate.mockReturnValue(cadena(null));
      modelo.findOne.mockReturnValue(cadena(turnoActivo(new Date())));

      await expect(
        servicio.cerrar(7, id, { estado: 'listo' }, { usuarioId: 9, nombre: 'Luis' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un turno ya cerrado no se vuelve a tocar', async () => {
      const cerrado = { ...turnoActivo(new Date()), activo: false, estado: 'listo' };
      modelo.findOneAndUpdate.mockReturnValue(cadena(null));
      modelo.findOne.mockReturnValue(cadena(cerrado));

      await expect(servicio.cerrar(7, id, { estado: 'error' }, autor)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('un turno inexistente responde 404', async () => {
      modelo.findOneAndUpdate.mockReturnValue(cadena(null));
      modelo.findOne.mockReturnValue(cadena(null));

      await expect(servicio.cerrar(7, id, { estado: 'listo' }, autor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un id que no es ObjectId responde 404 sin consultar', async () => {
      await expect(servicio.cerrar(7, 'no-es-id', { estado: 'listo' }, autor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(modelo.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('eliminarPorProyecto', () => {
    it('borra los turnos del proyecto', async () => {
      modelo.deleteMany.mockReturnValue(cadena({ deletedCount: 2 }));

      await expect(servicio.eliminarPorProyecto(7)).resolves.toBe(2);
      expect(modelo.deleteMany).toHaveBeenCalledWith({ proyectoId: 7 });
    });
  });
});
