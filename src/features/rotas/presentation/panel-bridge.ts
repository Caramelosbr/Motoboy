/**
 * Ponte entre o painel legado e a feature Rotas (strangler pattern).
 * O objeto de rota do monólito já tem o formato da entidade (mesmos campos +
 * id estável), então o write-through é quase pass-through.
 */

import { rotasService } from '../index';
import type { Rota } from '../index';

declare global {
  interface Window {
    __motoboyRotas?: {
      save(rota: Rota): Promise<void>;
      remove(id: string): Promise<void>;
    };
    __applyRemoteRotas?: (entities: Rota[]) => void;
  }
}

export function installRotasBridge(): void {
  window.__motoboyRotas = {
    async save(rota) {
      try {
        await rotasService.save(rota);
      } catch {
        /* offline/erro: mantém o cache local */
      }
    },
    async remove(id) {
      try {
        await rotasService.remove(id);
      } catch {
        /* offline/erro: mantém o cache local */
      }
    },
  };
}

export async function loadRotasIntoPanel(): Promise<void> {
  try {
    const items = await rotasService.list();
    window.__applyRemoteRotas?.(items);
  } catch {
    /* offline/sem permissão: mantém o cache local */
  }
}
