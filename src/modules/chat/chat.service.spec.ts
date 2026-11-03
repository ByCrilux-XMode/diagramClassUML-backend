import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatService } from './chat.service.js';

/**
 * El resumen rodante solo se escribe si avanza. Esta prueba fija las tres
 * condiciones del endpoint: el mensaje pertenece a la sala, la fecha sale del
 * mensaje y una actualización atrasada no pisa la vigente.
 */
describe('ChatService.actualizarResumen', () => {
  const salaVigente = {
    _id: 'sala-1',
    proyectoId: 7,
    tipo: 'grupo',
    creadaEn: new Date('2026-10-01T00:00:00.000Z'),
    resumen: null,
  };

  function crearServicio(opciones: {
    mensaje?: { creadoEn: Date } | null;
    actualizada?: unknown;
  }) {
    const salaModel = {
      findOneAndUpdate: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(opciones.actualizada ?? null),
      }),
    };
    const mensajeModel = {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(opciones.mensaje ?? null),
      }),
    };
    const stream = { emitir: vi.fn() };
    const servicio = new ChatService(salaModel as never, mensajeModel as never, stream as never);
    // `obtenerOCrearSala` se usa para resolver la sala; se sustituye para no
    // arrastrar el upsert al centro de la prueba.
    vi.spyOn(servicio, 'obtenerOCrearSala').mockResolvedValue(salaVigente as never);
    return { servicio, salaModel, mensajeModel };
  }

  it('guarda un resumen que avanza y deriva la fecha del mensaje', async () => {
    const creadoEn = new Date('2026-10-30T14:02:00.000Z');
    const actualizada = { ...salaVigente, resumen: { texto: 'Acuerdo', hastaCreadoEn: creadoEn } };
    const { servicio, salaModel } = crearServicio({ mensaje: { creadoEn }, actualizada });

    const resultado = await servicio.actualizarResumen(7, {
      texto: '  Acuerdo del equipo  ',
      hastaMensajeId: '65f000000000000000000001',
      modelo: 'modelo-barato',
    });

    expect(resultado.actualizado).toBe(true);
    const filtro = salaModel.findOneAndUpdate.mock.calls[0][0] as Record<string, unknown>;
    const update = salaModel.findOneAndUpdate.mock.calls[0][1] as {
      $set: { resumen: Record<string, unknown> };
    };
    expect(filtro.proyectoId).toBe(7);
    expect(update.$set.resumen.hastaCreadoEn).toBe(creadoEn);
    expect(update.$set.resumen.texto).toBe('Acuerdo del equipo');
    expect(update.$set.resumen.modelo).toBe('modelo-barato');
  });

  it('no pisa un resumen más nuevo y devuelve actualizado: false', async () => {
    const { servicio } = crearServicio({
      mensaje: { creadoEn: new Date('2026-10-20T10:00:00.000Z') },
      actualizada: null,
    });

    const resultado = await servicio.actualizarResumen(7, {
      texto: 'Resumen viejo',
      hastaMensajeId: '65f000000000000000000001',
    });

    expect(resultado.actualizado).toBe(false);
    expect(resultado.sala).toEqual(salaVigente);
  });

  it('rechaza un mensaje que no pertenece a la sala con 404', async () => {
    const { servicio, salaModel } = crearServicio({ mensaje: null });

    await expect(
      servicio.actualizarResumen(7, {
        texto: 'Resumen',
        hastaMensajeId: '65f000000000000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(salaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('serializa el _id de los mensajes como cadena para usarlo como clave', async () => {
    const objectId = new Types.ObjectId('65f000000000000000000001');
    const mensajeModel = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          { _id: objectId, creadoEn: new Date('2026-10-30T14:02:00.000Z'), contenido: 'Hola' },
        ]),
      }),
    };
    const servicio = new ChatService(
      { findOneAndUpdate: vi.fn() } as never,
      mensajeModel as never,
      { emitir: vi.fn() } as never,
    );
    vi.spyOn(servicio, 'obtenerOCrearSala').mockResolvedValue({ _id: 'sala-1' } as never);

    const resultado = await servicio.listar(7, { limite: 10 });

    expect(resultado.datos[0]?._id).toBe(objectId.toHexString());
  });

  it('rechaza un id de mensaje inválido con 400', async () => {
    const { servicio, mensajeModel } = crearServicio({ mensaje: null });

    await expect(
      servicio.actualizarResumen(7, { texto: 'Resumen', hastaMensajeId: 'no-es-un-id' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mensajeModel.findOne).not.toHaveBeenCalled();
  });
});
