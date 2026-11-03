import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EventosService } from './eventos.service.js';

/**
 * Los filtros de la bitácora son la base de `consultarHistorial`: si el
 * servidor ignora `desde`, `hasta` o `actorNombre`, la IA responde con datos
 * que no corresponden a la pregunta.
 */
describe('EventosService.listar', () => {
  const crearConsulta = (resultado: unknown[]) => {
    const cadena = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(resultado),
    };
    return cadena;
  };

  const crearServicio = (cadena: ReturnType<typeof crearConsulta>) => {
    const modelo = { find: vi.fn().mockReturnValue(cadena) };
    return { servicio: new EventosService(modelo as never), modelo };
  };

  it('filtra por nombre de actor y por rango de fechas', async () => {
    const cadena = crearConsulta([]);
    const { servicio, modelo } = crearServicio(cadena);
    const desde = '2026-10-01T00:00:00.000Z';
    const hasta = '2026-10-31T23:59:59.999Z';

    await servicio.listar(7, {
      limite: 20,
      actorNombre: 'Ana Pérez',
      desde,
      hasta,
    });

    const consulta = modelo.find.mock.calls[0][0] as Record<string, unknown>;
    expect(consulta.proyectoId).toBe(7);
    expect(consulta.actorNombre).toBe('Ana Pérez');
    expect(consulta.creadoEn).toEqual({
      $gte: new Date(desde),
      $lte: new Date(hasta),
    });
  });

  it('acepta un rango abierto', async () => {
    const cadena = crearConsulta([]);
    const { servicio, modelo } = crearServicio(cadena);

    await servicio.listar(7, { limite: 20, desde: '2026-10-01T00:00:00.000Z' });

    const consulta = modelo.find.mock.calls[0][0] as Record<string, unknown>;
    expect(consulta.creadoEn).toEqual({ $gte: new Date('2026-10-01T00:00:00.000Z') });
  });

  it('rechaza un rango invertido con 400', async () => {
    const cadena = crearConsulta([]);
    const { servicio, modelo } = crearServicio(cadena);

    await expect(
      servicio.listar(7, {
        limite: 20,
        desde: '2026-10-31T00:00:00.000Z',
        hasta: '2026-10-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(modelo.find).not.toHaveBeenCalled();
  });

  it('serializa el _id de Mongo como cadena para el cliente', async () => {
    const objectId = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
    const cadena = crearConsulta([
      { _id: objectId, creadoEn: new Date('2026-11-01T10:00:00.000Z'), proyectoId: 7 },
    ]);
    const { servicio } = crearServicio(cadena);

    const resultado = await servicio.listar(7, { limite: 20 });

    expect(resultado.datos).toHaveLength(1);
    expect(resultado.datos[0]?._id).toBe(objectId.toHexString());
  });
});

describe('EventosService.ultimoTurnoIA', () => {
  const id = (valor: string) => new Types.ObjectId(valor.padStart(24, '0'));

  const evento = (input: {
    turnoId?: string;
    creadoEn: string;
    id?: string;
    entidades: string[];
    cambios: Array<Record<string, unknown>>;
  }) => ({
    _id: id(input.id ?? '1'),
    proyectoId: 7,
    turnoId: input.turnoId ?? 'turno-ia',
    actorTipo: 'ia',
    entidades: input.entidades,
    cambios: input.cambios,
    creadoEn: new Date(input.creadoEn),
  });

  function cadena(resultado: unknown) {
    return {
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(resultado),
    };
  }

  function crearServicio(opciones: {
    ultimo: unknown;
    eventos?: unknown[];
    posterior?: unknown;
  }) {
    const primera = cadena(opciones.ultimo);
    const segunda = cadena(opciones.posterior ?? null);
    const find = cadena(opciones.eventos ?? []);
    const modelo = {
      findOne: vi.fn().mockReturnValueOnce(primera).mockReturnValueOnce(segunda),
      find: vi.fn().mockReturnValue(find),
    };
    return { servicio: new EventosService(modelo as never), modelo, primera, segunda, find };
  }

  it('sin turnos de IA devuelve un resultado vacío sin consultar eventos', async () => {
    const { servicio, modelo } = crearServicio({ ultimo: null });

    const resultado = await servicio.ultimoTurnoIA(7);

    expect(resultado).toEqual({
      turnoId: null,
      eventos: [],
      deshacible: false,
      motivo: 'El proyecto todavía no tiene ningún turno de edición de la IA.',
      entidades: [],
    });
    expect(modelo.find).not.toHaveBeenCalled();
  });

  it('un turno cuyas entidades no cambiaron después es deshacible', async () => {
    const eventos = [
      evento({
        creadoEn: '2026-11-01T10:00:00.000Z',
        entidades: ['clase:pedido'],
        cambios: [
          {
            accion: 'crear',
            entidadTipo: 'clase',
            entidadKey: 'clase:pedido',
            despues: { name: 'Pedido' },
          },
        ],
      }),
      evento({
        creadoEn: '2026-11-01T10:00:01.000Z',
        id: '2',
        entidades: ['clase:pedido'],
        cambios: [
          {
            accion: 'actualizar',
            entidadTipo: 'atributo',
            entidadKey: 'clase:pedido',
            campo: 'name',
            antes: 'Pedido',
            despues: 'PedidoVenta',
          },
        ],
      }),
    ];
    const { servicio, segunda } = crearServicio({ ultimo: eventos[1], eventos });

    const resultado = await servicio.ultimoTurnoIA(7);

    expect(resultado.deshacible).toBe(true);
    expect(resultado.turnoId).toBe('turno-ia');
    expect(resultado.eventos).toHaveLength(2);
    expect(resultado.entidades).toEqual(['clase:pedido']);
    const filtro = segunda.exec.mock.calls.length; // se consultó la posterior
    expect(filtro).toBe(1);
  });

  it('una edición humana posterior sobre la misma entidad lo vuelve no deshacible', async () => {
    const eventos = [
      evento({
        creadoEn: '2026-11-01T10:00:00.000Z',
        entidades: ['clase:pedido'],
        cambios: [
          {
            accion: 'actualizar',
            entidadTipo: 'clase',
            entidadKey: 'clase:pedido',
            campo: 'name',
            antes: 'Pedido',
            despues: 'Compra',
          },
        ],
      }),
    ];
    const { servicio, modelo } = crearServicio({
      ultimo: eventos[0],
      eventos,
      posterior: { _id: id('9') },
    });

    const resultado = await servicio.ultimoTurnoIA(7);

    expect(resultado.deshacible).toBe(false);
    expect(resultado.motivo).toContain('cambió después');
    const filtro = modelo.findOne.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(filtro).toMatchObject({
      proyectoId: 7,
      turnoId: { $ne: 'turno-ia' },
      entidades: { $in: ['clase:pedido'] },
    });
  });

  it('un cambio sin valor anterior no se puede reconstruir', async () => {
    const eventos = [
      evento({
        creadoEn: '2026-11-01T10:00:00.000Z',
        entidades: ['clase:importada'],
        cambios: [
          {
            accion: 'actualizar',
            entidadTipo: 'clase',
            entidadKey: 'clase:importada',
            campo: 'name',
            despues: 'Importada',
          },
        ],
      }),
    ];
    const { servicio, modelo } = crearServicio({ ultimo: eventos[0], eventos });

    const resultado = await servicio.ultimoTurnoIA(7);

    expect(resultado.deshacible).toBe(false);
    expect(resultado.motivo).toContain('no tiene valor anterior');
    // No tiene sentido consultar eventos posteriores si ya no es reversible.
    expect(modelo.findOne).toHaveBeenCalledTimes(1);
  });

  it('una creación sin antes sí es reversible (su inversa es eliminar)', async () => {
    const eventos = [
      evento({
        creadoEn: '2026-11-01T10:00:00.000Z',
        entidades: ['clase:nueva'],
        cambios: [
          {
            accion: 'crear',
            entidadTipo: 'clase',
            entidadKey: 'clase:nueva',
            despues: { name: 'Nueva' },
          },
        ],
      }),
    ];
    const { servicio } = crearServicio({ ultimo: eventos[0], eventos });

    await expect(servicio.ultimoTurnoIA(7)).resolves.toMatchObject({ deshacible: true });
  });

  it('un turno sin cambios no ofrece deshacer', async () => {
    const eventos = [
      evento({
        creadoEn: '2026-11-01T10:00:00.000Z',
        entidades: [],
        cambios: [],
      }),
    ];
    const { servicio } = crearServicio({ ultimo: eventos[0], eventos });

    const resultado = await servicio.ultimoTurnoIA(7);

    expect(resultado.deshacible).toBe(false);
    expect(resultado.motivo).toContain('no registró cambios');
  });
});
