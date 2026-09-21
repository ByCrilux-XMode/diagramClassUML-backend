import type * as YTipos from 'yjs';
import { Y } from './yjs-servidor.js';
import { CLAVE_ESQUEMA, ORIGEN_CARGA } from './colaboracion.constantes.js';

function codificar(valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object') {
    return valor;
  }
  if (Array.isArray(valor)) {
    const arreglo = new Y.Array<unknown>();
    arreglo.push(valor.map((item) => codificar(item)));
    return arreglo;
  }
  const mapa = new Y.Map<unknown>();
  for (const [clave, item] of Object.entries(valor)) {
    mapa.set(clave, codificar(item));
  }
  return mapa;
}

function decodificar(valor: unknown): unknown {
  if (!valor || typeof valor !== 'object') {
    return valor;
  }
  if (
    valor instanceof Y.Array ||
    typeof (valor as YTipos.Array<unknown>).toArray === 'function'
  ) {
    return (valor as YTipos.Array<unknown>).toArray().map((item) => decodificar(item));
  }
  if (
    valor instanceof Y.Map ||
    (typeof (valor as YTipos.Map<unknown>).get === 'function' &&
      typeof (valor as YTipos.Map<unknown>).set === 'function' &&
      typeof (valor as YTipos.Map<unknown>).forEach === 'function')
  ) {
    const resultado: Record<string, unknown> = {};
    (valor as YTipos.Map<unknown>).forEach((item, clave) => {
      resultado[clave] = decodificar(item);
    });
    return resultado;
  }
  return valor;
}

export function aplicarJson(doc: YTipos.Doc, esquema: Record<string, unknown> | null | undefined): void {
  doc.transact(() => {
    const mapa = doc.getMap<unknown>(CLAVE_ESQUEMA);
    mapa.forEach((_valor, clave) => {
      mapa.delete(clave);
    });
    if (esquema && typeof esquema === 'object') {
      // Reparar arreglos corruptos por el bug previo de duck-typing
      const esquemaReparado = { ...esquema };
      for (const clave of ['nodeDataArray', 'linkDataArray']) {
        const valor = esquemaReparado[clave];
        if (valor && typeof valor === 'object' && !Array.isArray(valor) && Object.keys(valor).every(k => !isNaN(Number(k)))) {
          esquemaReparado[clave] = Object.values(valor);
        }
      }
      
      for (const [clave, valor] of Object.entries(esquemaReparado)) {
        mapa.set(clave, codificar(valor));
      }
    }
  }, ORIGEN_CARGA);
}

export function extraerJson(doc: YTipos.Doc): Record<string, unknown> | null {
  const mapa = doc.getMap<unknown>(CLAVE_ESQUEMA);
  if (mapa.size === 0) {
    return null;
  }
  const resultado: Record<string, unknown> = {};
  mapa.forEach((valor, clave) => {
    resultado[clave] = decodificar(valor);
  });
  return resultado;
}