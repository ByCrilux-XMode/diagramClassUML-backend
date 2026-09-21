import { docs, getPersistence } from 'y-websocket/bin/utils';
import { DEBOUNCE_AUTOSAVE_MS } from './colaboracion.constantes.js';
import { PersistenciaColaboracionService } from './persistencia-colaboracion.service.js';
import { Y } from './yjs-servidor.js';

describe('PersistenciaColaboracionService', () => {
  const crearServicio = () => {
    const repositorioDocumentos = { findOneBy: vi.fn(), create: vi.fn(), save: vi.fn() };
    const repositorioProyectos = { create: vi.fn(), save: vi.fn(), findOneBy: vi.fn() };
    repositorioDocumentos.create.mockImplementation((entidad) => entidad);
    repositorioProyectos.create.mockImplementation((entidad) => entidad);
    const servicio = new PersistenciaColaboracionService(
      repositorioProyectos as never,
      repositorioDocumentos as never,
    );
    servicio.onModuleInit();
    return { servicio, repositorioDocumentos, repositorioProyectos };
  };

  beforeEach(() => {
    docs.clear();
  });

  it('bindState carga el esquema temporal al documento', async () => {
    const { repositorioDocumentos } = crearServicio();
    repositorioDocumentos.findOneBy.mockResolvedValue({
      proyectoId: 5,
      esquemaTemporal: { nombre: 'Temporal' },
    });

    const doc = new Y.Doc();
    await getPersistence()?.bindState('5', doc);

    expect(doc.getMap<unknown>('esquema').get('nombre')).toBe('Temporal');
  });

  it('bindState carga el esquema del proyecto cuando no existe temporal', async () => {
    const { repositorioDocumentos, repositorioProyectos } = crearServicio();
    repositorioDocumentos.findOneBy.mockResolvedValue(null);
    repositorioProyectos.findOneBy.mockResolvedValue({ proyectoId: 7, esquemaJson: { nombre: 'ProyectoInicial' } });

    const doc = new Y.Doc();
    await getPersistence()?.bindState('7', doc);

    expect(doc.getMap<unknown>('esquema').get('nombre')).toBe('ProyectoInicial');
  });

  it('persiste el temporal con debounce tras una actualización', async () => {
    vi.useFakeTimers();
    try {
      const { repositorioDocumentos } = crearServicio();
      repositorioDocumentos.findOneBy.mockResolvedValue(null);

      const doc = new Y.Doc();
      await getPersistence()?.bindState('5', doc);
      doc.getMap<unknown>('esquema').set('nombre', 'editado');
      await vi.advanceTimersByTimeAsync(DEBOUNCE_AUTOSAVE_MS + 50);

      expect(repositorioDocumentos.save).toHaveBeenCalledWith(
        expect.objectContaining({ proyectoId: 5, esquemaTemporal: { nombre: 'editado' } }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('writeState persiste el documento temporal', async () => {
    const { repositorioDocumentos } = crearServicio();

    const doc = new Y.Doc();
    doc.getMap<unknown>('esquema').set('nombre', 'final');
    await getPersistence()?.writeState('5', doc);

    expect(repositorioDocumentos.save).toHaveBeenCalledWith(
      expect.objectContaining({ proyectoId: 5, esquemaTemporal: { nombre: 'final' } }),
    );
  });

  it('commit concretiza el esquema vivo en el proyecto', async () => {
    const { servicio, repositorioProyectos } = crearServicio();

    const doc = new Y.Doc();
    doc.getMap<unknown>('esquema').set('class', 'GraphLinksModel');
    docs.set('8', doc);

    await servicio.commit('8');

    expect(repositorioProyectos.save).toHaveBeenCalledWith(
      expect.objectContaining({ proyectoId: 8, esquemaJson: { class: 'GraphLinksModel' } }),
    );
  });

  it('commit usa el temporal cuando no hay documento vivo', async () => {
    const { servicio, repositorioProyectos, repositorioDocumentos } = crearServicio();
    repositorioDocumentos.findOneBy.mockResolvedValue({
      proyectoId: 8,
      esquemaTemporal: { nodeDataArray: [{ key: 'n1', name: 'Clase' }] },
    });

    await servicio.commit('8');

    expect(repositorioProyectos.save).toHaveBeenCalledWith(
      expect.objectContaining({
        proyectoId: 8,
        esquemaJson: { nodeDataArray: [{ key: 'n1', name: 'Clase' }] },
      }),
    );
  });

  it('commit no hace nada sin documento vivo ni temporal', async () => {
    const { servicio, repositorioProyectos, repositorioDocumentos } = crearServicio();
    repositorioDocumentos.findOneBy.mockResolvedValue(null);

    await servicio.commit('9');

    expect(repositorioProyectos.save).not.toHaveBeenCalled();
  });
});