import { Injectable, Logger } from '@nestjs/common';
import type { ProveedorConfig } from './config-ia.schema.js';

const URLS_MODELOS: Partial<Record<ProveedorConfig, string>> = {
  openrouter: 'https://openrouter.ai/api/v1/models',
  huggingface: 'https://router.huggingface.co/v1/models',
  // hf-space es un endpoint Gradio propio: no publica un catálogo consultable.
  'hf-space': undefined,
};

const TIMEOUT_MODELOS_MS = 3000;

/**
 * Validación best-effort del modelo preferido. Si el proveedor no responde, el
 * catálogo no está disponible o el proveedor no lo publica, devuelve `null` y
 * el guardado continúa (D58): la conformidad real la prueba el cliente.
 */
@Injectable()
export class ValidadorModelosService {
  private readonly logger = new Logger(ValidadorModelosService.name);

  async modelosDe(proveedor: ProveedorConfig): Promise<string[] | null> {
    const url = URLS_MODELOS[proveedor];
    if (!url) return null;
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MODELOS_MS) });
      if (!respuesta.ok) return null;
      const json = (await respuesta.json()) as
        | Array<{ id?: string }>
        | { data?: Array<{ id?: string }> };
      const items = Array.isArray(json) ? json : (json.data ?? []);
      const ids = items
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      return ids.length > 0 ? ids : null;
    } catch (err: unknown) {
      this.logger.debug(
        `No se pudo validar el modelo contra ${proveedor}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
