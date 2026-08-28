/**
 * Domínio de Abastecimentos.
 *
 * Camada mais interna da Clean Architecture: só regras e formato dos dados.
 * NÃO conhece Firestore, DOM nem formatação de exibição (isso fica em
 * infrastructure/presentation). Texto como "12,5 L" ou "há 2 dias" é
 * responsabilidade da apresentação, não da entidade.
 */

/** Um abastecimento pertencente a um motoboy. */
export interface Abastecimento {
  id: string;
  /** Data no formato ISO local (yyyy-mm-dd). */
  dateISO: string;
  /** Nome do posto. */
  location: string;
  /** Valor pago em reais. */
  paidValue: number;
  /** Preço por litro em reais. */
  pricePerLiter: number;
  /** Litros abastecidos. */
  liters: number;
  /** Odômetro (km) no momento, quando informado. */
  odometer: number | null;
  /** Marca se o registro foi editado depois de criado. */
  edited: boolean;
  /** Motivo da última edição, quando houver. */
  editReason: string | null;
  /** Época (ms) de criação e da última atualização. */
  createdAt: number;
  updatedAt: number;
}

/** Dados de entrada para criar um abastecimento (sem campos gerados). */
export interface NewAbastecimento {
  dateISO: string;
  location: string;
  paidValue: number;
  pricePerLiter: number;
  odometer?: number | null;
}

/** Dados de entrada para editar (todos opcionais + motivo da edição). */
export interface EditAbastecimento {
  dateISO?: string;
  location?: string;
  paidValue?: number;
  pricePerLiter?: number;
  odometer?: number | null;
  editReason?: string | null;
}

/** Litros derivados de valor pago e preço por litro (0 se preço inválido). */
export function computeLiters(paidValue: number, pricePerLiter: number): number {
  if (!pricePerLiter || pricePerLiter <= 0) return 0;
  return paidValue / pricePerLiter;
}

/**
 * Porta de saída (Dependency Inversion): o caso de uso depende desta
 * interface, não de uma implementação concreta. O Firestore é só um detalhe
 * em infrastructure; amanhã poderia ser outro banco sem mudar o domínio.
 */
export interface AbastecimentoRepository {
  list(): Promise<Abastecimento[]>;
  add(data: NewAbastecimento): Promise<Abastecimento>;
  update(id: string, data: EditAbastecimento): Promise<void>;
  remove(id: string): Promise<void>;
  /** Atualizações em tempo real (opcional). Retorna função para cancelar. */
  observe(callback: (items: Abastecimento[]) => void): () => void;
}
