import { describe, it, expect } from 'vitest';
import { toCents } from '../../../shared/currency';
import { validatePayment, type Payment } from './index';

function payment(over: Partial<Payment> = {}): Payment {
  return {
    id: 'p1',
    clientId: 'c1',
    amountCents: toCents(1000),
    allocations: [{ receivableId: 'r1', amountCents: toCents(1000) }],
    effectiveDate: '2026-08-30',
    idempotencyKey: 'idem-key_1',
    requestHash: 'hash123',
    kind: 'payment',
    ...over,
  };
}

describe('validatePayment', () => {
  it('pagamento válido (uma allocation)', () => {
    expect(validatePayment(payment()).ok).toBe(true);
  });
  it('pagamento válido cobrindo várias contas', () => {
    const p = payment({
      amountCents: toCents(1000),
      allocations: [
        { receivableId: 'r1', amountCents: toCents(600) },
        { receivableId: 'r2', amountCents: toCents(400) },
      ],
    });
    expect(validatePayment(p).ok).toBe(true);
  });
  it('reversão válida', () => {
    const p = payment({ kind: 'reversal', reversesPaymentId: 'p0' });
    expect(validatePayment(p).ok).toBe(true);
  });
  it('rejeita allocations vazias', () => {
    const r = validatePayment(payment({ allocations: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_ALLOCATIONS');
  });
  it('rejeita allocation com valor zero', () => {
    const r = validatePayment(
      payment({ allocations: [{ receivableId: 'r1', amountCents: toCents(0) }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_ALLOCATION');
  });
  it('rejeita receivable duplicado', () => {
    const r = validatePayment(
      payment({
        amountCents: toCents(1000),
        allocations: [
          { receivableId: 'r1', amountCents: toCents(500) },
          { receivableId: 'r1', amountCents: toCents(500) },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_RECEIVABLE');
  });
  it('rejeita soma diferente do amount', () => {
    const r = validatePayment(
      payment({
        amountCents: toCents(1000),
        allocations: [{ receivableId: 'r1', amountCents: toCents(900) }],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ALLOCATIONS_SUM_MISMATCH');
  });
  it('detecta overflow na soma das allocations', () => {
    const half = toCents(Number.MAX_SAFE_INTEGER);
    const r = validatePayment(
      payment({
        amountCents: toCents(2),
        allocations: [
          { receivableId: 'r1', amountCents: half },
          { receivableId: 'r2', amountCents: half },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SUM_OVERFLOW');
  });
  it('payment com reversesPaymentId é rejeitado', () => {
    const r = validatePayment(payment({ reversesPaymentId: 'p0' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PAYMENT_HAS_REVERSES');
  });
  it('reversal sem reversesPaymentId é rejeitado', () => {
    const r = validatePayment(payment({ kind: 'reversal' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('REVERSAL_MISSING_REVERSES');
  });
  it('data inválida', () => {
    const r = validatePayment(payment({ effectiveDate: '2026-13-01' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_DATE');
  });
  it('idempotencyKey inválida', () => {
    const r = validatePayment(payment({ idempotencyKey: 'chave inválida/x' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_IDEMPOTENCY_KEY');
  });
  it('requestHash vazio', () => {
    const r = validatePayment(payment({ requestHash: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_REQUEST_HASH');
  });
});

describe('Payment imutabilidade', () => {
  it('validatePayment não altera o objeto original', () => {
    const p = payment();
    const snapshot = JSON.stringify(p);
    validatePayment(p);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});
