/**
 * Ponte entre o painel legado e a feature Manutenções (strangler pattern).
 * Traduz o view-model do monólito (maintenances) ↔ entidade e faz o
 * write-through para o Firestore. O monólito continua dono da UI.
 */

import { manutencoesService } from '../index';
import type { EditManutencao, Manutencao, NewManutencao } from '../index';

/** Formato do registro como o monólito mantém em `maintenances`. */
interface MaintenanceVM {
  fsId?: string | null;
  category: string;
  desc: string;
  valor: number;
  km: number | null;
  dateISO: string;
  editReason?: string | null;
}

function vmToNew(vm: MaintenanceVM): NewManutencao {
  return {
    category: vm.category,
    desc: vm.desc,
    valor: vm.valor,
    km: vm.km ?? null,
    dateISO: vm.dateISO,
  };
}

function vmToEdit(vm: MaintenanceVM): EditManutencao {
  return { ...vmToNew(vm), editReason: vm.editReason ?? null };
}

declare global {
  interface Window {
    __motoboyManutencoes?: {
      add(vm: MaintenanceVM): Promise<string | null>;
      update(fsId: string | null | undefined, vm: MaintenanceVM): Promise<void>;
      remove(fsId: string | null | undefined): Promise<void>;
    };
    __applyRemoteManutencoes?: (entities: Manutencao[]) => void;
  }
}

export function installManutencoesBridge(): void {
  window.__motoboyManutencoes = {
    async add(vm) {
      try {
        const created = await manutencoesService.add(vmToNew(vm));
        return created.id;
      } catch {
        return null;
      }
    },
    async update(fsId, vm) {
      if (!fsId) return;
      try {
        await manutencoesService.update(fsId, vmToEdit(vm));
      } catch {
        /* offline/erro: mantém o cache local */
      }
    },
    async remove(fsId) {
      if (!fsId) return;
      try {
        await manutencoesService.remove(fsId);
      } catch {
        /* offline/erro: mantém o cache local */
      }
    },
  };
}

export async function loadManutencoesIntoPanel(): Promise<void> {
  try {
    const items = await manutencoesService.list();
    window.__applyRemoteManutencoes?.(items);
  } catch {
    /* offline/sem permissão: mantém o cache local */
  }
}
