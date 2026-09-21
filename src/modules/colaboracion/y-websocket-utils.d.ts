declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';
  import type * as Y from 'yjs';

  export interface PersistenciaYjs {
    bindState(nombreDocumento: string, documento: Y.Doc): void | Promise<void>;
    writeState(nombreDocumento: string, documento: Y.Doc): Promise<void>;
    provider?: unknown;
  }

  export function setPersistence(persistencia: PersistenciaYjs | null): void;

  export function getPersistence(): PersistenciaYjs | null;

  export const docs: Map<string, Y.Doc>;

  export interface OpcionesConexion {
    docName?: string;
    gc?: boolean;
  }

  export function setupWSConnection(
    conexion: WebSocket,
    peticion: IncomingMessage,
    opciones?: OpcionesConexion,
  ): void;

  export class WSSharedDoc extends Y.Doc {
    name: string;
    gc: boolean;
    conns: Map<WebSocket, Set<number>>;
    awareness: unknown;
    whenInitialized: Promise<void>;
  }
}