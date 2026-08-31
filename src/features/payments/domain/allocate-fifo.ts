/**
 * Algoritmo FIFO puro de alocação de um pagamento entre recebíveis abertos.
 *
 * Não muta o array nem as entidades recebidas: ordena uma cópia e produz novas
 * entidades via `applyAllocation`. Toda validação ocorre antes do cálculo; em
 * qualquer erro, nada parcial escapa (o resultado é sempre tudo-ou-nada).
 *
 * Dependência permitida: payments -> receivables (nunca o contrário).
 */

import { type Cents, toCents } from '../../../shared/currency';
import {
  type Receivable,
  remainingCents,
  applyAllocation,
  validateReceivable,
} from '../../receivables/domain';
import type { Allocation } from './payment';

/** Limite operacional deliberado (ver DEC-015): 100 aceitos, 101 rejeitados. */
export const MAX_FIFO = 100;

export type AllocationErrorCode =
  | 'INVALID_AMOUNT'
  | 'EMPTY_RECEIVABLES'
  | 'MIXED_CLIENTS'
  | 'DUPLICATE_RECEIVABLE'
  | 'INELIGIBLE_RECEIVABLE'
  | 'INSUFFICIENT_BALANCE'
  | 'MAX_FIFO_EXCEEDED'
  | 'INVALID_RECEIVABLE';

export interface AllocateSuccess {
  readonly ok: true;
  readonly allocations: readonly Allocation[];
  readonly updatedReceivables: readonly Receivable[];
  readonly clientId: string;
  readonly amountCents: Cents;
}

export interface AllocateFailure {
  readonly ok: false;
  readonly code: AllocationErrorCode;
  readonly message: string;
}

export type AllocationResult = AllocateSuccess | AllocateFailure;

function isCents(n: number): n is Cents {
  try {
    toCents(n);
    return true;
  } catch {
    return false;
  }
}

function fail(code: AllocationErrorCode, message: string): AllocateFailure {
  return { ok: false, code, message };
}

// Ordenação estável do FIFO: effectiveDate, depois createdAtEpochMs, depois id.
function fifoCompare(a: Receivable, b: Receivable): number {
  if (a.effectiveDate < b.effectiveDate) return -1;
  if (a.effectiveDate > b.effectiveDate) return 1;
  if (a.createdAtEpochMs !== b.createdAtEpochMs) return a.createdAtEpochMs - b.createdAtEpochMs;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Aloca `paymentAmount` entre `receivables` (todos do mesmo cliente, open|partial),
 * do mais antigo para o mais novo. Retorna sucesso com allocations +
 * updatedReceivables (apenas os afetados, em ordem FIFO) ou uma falha discriminada.
 */
export function allocateFIFO(
  receivables: readonly Receivable[],
  paymentAmount: Cents,
): AllocationResult {
  if (!isCents(paymentAmount) || (paymentAmount as number) <= 0) {
    return fail('INVALID_AMOUNT', 'paymentAmount deve ser Cents > 0.');
  }
  if (receivables.length === 0) return fail('EMPTY_RECEIVABLES', 'nenhum receivable informado.');
  if (receivables.length > MAX_FIFO) {
    return fail('MAX_FIFO_EXCEEDED', `acima de ${MAX_FIFO} recebíveis elegíveis.`);
  }

  const clientId = receivables[0].clientId;
  const seen = new Set<string>();
  for (const r of receivables) {
    if (!validateReceivable(r).ok) return fail('INVALID_RECEIVABLE', `receivable inválido: ${r.id}.`);
    if (r.status !== 'open' && r.status !== 'partial') {
      return fail('INELIGIBLE_RECEIVABLE', `receivable ${r.id} não está open/partial.`);
    }
    if (r.clientId !== clientId) return fail('MIXED_CLIENTS', 'receivables de clientes diferentes.');
    if (seen.has(r.id)) return fail('DUPLICATE_RECEIVABLE', `id repetido: ${r.id}.`);
    seen.add(r.id);
  }

  const ordered = [...receivables].sort(fifoCompare);

  const allocations: Allocation[] = [];
  const updatedReceivables: Receivable[] = [];
  let remaining = paymentAmount as number;

  for (const r of ordered) {
    if (remaining <= 0) break;
    const saldo = remainingCents(r) as number;
    if (saldo <= 0) continue; // proteção (não deve ocorrer em open/partial)
    const amount = (remaining < saldo ? remaining : saldo) as Cents;
    const applied = applyAllocation(r, amount);
    if (!applied.ok) return fail('INVALID_RECEIVABLE', `falha ao alocar em ${r.id}.`);
    allocations.push({ receivableId: r.id, amountCents: amount });
    updatedReceivables.push(applied.value);
    remaining -= amount as number;
  }

  if (remaining > 0) {
    return fail('INSUFFICIENT_BALANCE', 'saldo total insuficiente para o pagamento.');
  }

  return { ok: true, allocations, updatedReceivables, clientId, amountCents: paymentAmount };
}
