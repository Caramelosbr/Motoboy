/**
 * Domínio de Faturamento — Entradas (recebimentos manuais).
 *
 * Só as entradas MANUAIS pertencem a esta feature. Entradas geradas por Rotas
 * (com routeId/clientName) são responsabilidade de Rotas e não passam por aqui.
 */

export interface Entrada {
  id: string;
  desc: string;
  valor: number;
  /** Data ISO local (yyyy-mm-dd). */
  dateISO: string;
  edited: boolean;
  editReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewEntrada {
  desc: string;
  valor: number;
  dateISO: string;
}

export interface EditEntrada {
  desc?: string;
  valor?: number;
  dateISO?: string;
  editReason?: string | null;
}

export interface EntradaRepository {
  list(): Promise<Entrada[]>;
  add(data: NewEntrada): Promise<Entrada>;
  update(id: string, data: EditEntrada): Promise<void>;
  remove(id: string): Promise<void>;
  observe(callback: (items: Entrada[]) => void): () => void;
}
