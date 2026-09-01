/**
 * Porta de LEITURA da tabela de deslocamento ativa (DEC-020) — contrato neutro,
 * sem Firebase/onSnapshot/DOM. Somente leitura: não publica, não grava, não gera
 * versão e não lança erro de negócio (falha vira Result discriminado).
 *
 * Direção de dependência: application → domain. O domínio nunca importa isto.
 */

import type { PricingArea } from '../../domain';

export interface ActivePricingTableSnapshot {
  readonly activeVersionId: string | null;
  readonly revision: number;
  readonly areas: readonly PricingArea[];
}

export type PricingTableReadResult =
  | { readonly ok: true; readonly value: ActivePricingTableSnapshot }
  | { readonly ok: false; readonly code: 'READ_FAILED'; readonly message: string };

export interface PricingTableReadRepository {
  loadActivePricingTable(): Promise<PricingTableReadResult>;
}
