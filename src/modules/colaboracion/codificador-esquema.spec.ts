import { Y } from './yjs-servidor.js';
import { aplicarJson, extraerJson } from './codificador-esquema.js';
import { CLAVE_ESQUEMA } from './colaboracion.constantes.js';

describe('codificador-esquema', () => {
  it('devuelve null cuando el documento está vacío', () => {
    const doc = new Y.Doc();
    expect(extraerJson(doc)).toBeNull();
  });

  it('aplicar esquema nulo deja el documento vacío', () => {
    const doc = new Y.Doc();
    aplicarJson(doc, null);
    expect(extraerJson(doc)).toBeNull();
  });

  it('hace round-trip de un modelo GoJS completo', () => {
    const modelo = {
      class: 'GraphLinksModel',
      modelData: { position: '-1, -1', minScale: 0.1 },
      nodeDataArray: [
        {
          key: 'node-1',
          name: 'Cliente',
          category: 'Class',
          isAbstract: false,
          loc: '-50, 0',
          attributes: [
            { id: 'a1', visibility: 'private', type: 'string', name: 'nombre' },
            { id: 'a2', visibility: 'public', type: 'int', name: 'edad', extra: null },
          ],
          methods: [
            {
              id: 'm1',
              visibility: 'public',
              name: 'saludar',
              returnType: 'string',
              parameters: [{ name: 'saludo', type: 'string' }],
            },
          ],
        },
        { key: 'node-2', name: 'Estado', category: 'Enum', literals: ['ACTIVO', 'INACTIVO', 'SUSPENDIDO'] },
      ],
      linkDataArray: [{ key: 'link-1', from: 'node-1', to: 'node-2', category: 'association', label: 'usa' }],
    };

    const doc = new Y.Doc();
    aplicarJson(doc, modelo);

    expect(extraerJson(doc)).toEqual(modelo);
  });

  it('refleja cambios colaborativos posteriores en extraerJson', () => {
    const doc = new Y.Doc();
    aplicarJson(doc, { nodeDataArray: [] });
    const mapa = doc.getMap<unknown>(CLAVE_ESQUEMA);

    doc.transact(() => {
      mapa.set('nombre', 'Proyecto editado');
    });

    expect(extraerJson(doc)).toEqual({ nodeDataArray: [], nombre: 'Proyecto editado' });
  });
});