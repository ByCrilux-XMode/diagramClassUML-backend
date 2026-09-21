import { createRequire } from 'node:module';
import type * as YTipos from 'yjs';

const requireNode = createRequire(import.meta.url);

export const Y: typeof YTipos = requireNode('yjs');