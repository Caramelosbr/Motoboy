/**
 * Domínio de Rotas (histórico de rotas confirmadas).
 *
 * Uma rota confirmada é imutável (só confirma ou cancela) e já nasce com um
 * `id` estável no monólito (`rota-<timestamp>`) — usado como id do documento.
 *
 * Observação de escopo: as entradas de rota (recebido na hora) e as contas de
 * clientes derivadas ainda vivem localmente; serão fechadas na migração de
 * Clientes. Aqui persistimos apenas o histórico de rotas.
 */

export interface RotaEntrega {
  endereco: string;
  valor: number;
  distancia: number | null;
  tempo: number | null;
  aproximada: boolean;
}

export interface RotaService {
  coleta: string;
  cliente: string;
  paymentStatus: string;
  valorTotal: number;
  entregas: RotaEntrega[];
}

export interface Rota {
  id: string;
  count: number;
  distancia: number;
  tempoMin: number;
  valorTotal: number;
  custoCombustivel: number | null;
  resultado: number | null;
  recebidoNaHora: number;
  pendente: number;
  data: string;
  dateISO: string;
  hora: string;
  createdAt: string;
  consumoKmL: number;
  precoLitro: number;
  aproximada: boolean;
  services: RotaService[];
}

export interface RotaRepository {
  list(): Promise<Rota[]>;
  /** Upsert por id (confirmar rota). */
  save(rota: Rota): Promise<void>;
  /** Remover por id (cancelar rota). */
  remove(id: string): Promise<void>;
  observe(callback: (items: Rota[]) => void): () => void;
}
