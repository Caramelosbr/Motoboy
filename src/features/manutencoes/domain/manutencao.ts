/**
 * Domínio de Manutenções (gastos da moto/operação).
 *
 * Camada mais interna: só dados e regras. Não conhece Firestore nem DOM.
 * O texto de exibição da data (ex.: "20/08/2026") fica na apresentação.
 */

/** Um gasto/manutenção pertencente a um motoboy. */
export interface Manutencao {
  id: string;
  /** Categoria do gasto (ex.: 'maintenance', 'fuel', 'other'...). */
  category: string;
  /** Descrição do gasto. */
  desc: string;
  /** Valor pago em reais. */
  valor: number;
  /** Quilometragem no momento (só faz sentido em manutenção); null se não informado. */
  km: number | null;
  /** Data no formato ISO local (yyyy-mm-dd). */
  dateISO: string;
  edited: boolean;
  editReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewManutencao {
  category: string;
  desc: string;
  valor: number;
  km?: number | null;
  dateISO: string;
}

export interface EditManutencao {
  category?: string;
  desc?: string;
  valor?: number;
  km?: number | null;
  dateISO?: string;
  editReason?: string | null;
}

/** Porta de saída (Dependency Inversion): o caso de uso depende desta interface. */
export interface ManutencaoRepository {
  list(): Promise<Manutencao[]>;
  add(data: NewManutencao): Promise<Manutencao>;
  update(id: string, data: EditManutencao): Promise<void>;
  remove(id: string): Promise<void>;
  observe(callback: (items: Manutencao[]) => void): () => void;
}
