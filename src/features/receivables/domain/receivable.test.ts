import { describe, it, expect } from 'vitest';
import { toCents } from '../../../shared/currency';
import {
  validateReceivable,
  remainingCents,
  applyAllocation,
  reverseAllocation,
  cancelReceivable,
  type Receivable,
} from './index';

const SVC = 'svc_550e8400-e29b-41d4-a716-446655440000';

function routeReceivable(over: Partial<Receivable> = {}): Receivable {
  return {
    id: 'r1',
    clientId: 'c1',
    sourceType: 'route',
    sourceId: 'rota-1',
    serviceId: SVC,
    description: 'Rota · 2 entregas',
    amountCents: toCents(1000),
    paidCents: toCents(0),
    status: 'open',
    effectiveDate: '2026-08-30',
    createdAtEpochMs: 1_756_000_000_000,
    ...over,
  };
}

describe('validateReceivable — status válidos', () => {
  it('open', () => {
    expect(validateReceivable(routeReceivable()).ok).toBe(true);
  });
  it('partial', () => {
    expect(validateReceivable(routeReceivable({ paidCents: toCents(400), status: 'partial' })).ok).toBe(true);
  });
  it('paid', () => {
    expect(validateReceivable(routeReceivable({ paidCents: toCents(1000), status: 'paid' })).ok).toBe(true);
  });
  it('cancelled', () => {
    expect(validateReceivable(routeReceivable({ status: 'cancelled' })).ok).toBe(true);
  });
  it('manual sem serviceId', () => {
    const r = routeReceivable({ sourceType: 'manual', serviceId: undefined });
    expect(validateReceivable(r).ok).toBe(true);
  });
});

describe('validateReceivable — inválidos', () => {
  it('amount zero', () => {
    const r = validateReceivable(routeReceivable({ amountCents: toCents(0) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
  it('overpaid', () => {
    const r = validateReceivable(routeReceivable({ paidCents: toCents(1200), status: 'paid' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PAID_OVER_AMOUNT');
  });
  it('status open com paid > 0', () => {
    const r = validateReceivable(routeReceivable({ paidCents: toCents(100), status: 'open' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STATUS_PAID_MISMATCH');
  });
  it('status paid sem quitar', () => {
    const r = validateReceivable(routeReceivable({ paidCents: toCents(500), status: 'paid' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STATUS_PAID_MISMATCH');
  });
  it('cancelled com paid > 0', () => {
    const r = validateReceivable(routeReceivable({ paidCents: toCents(100), status: 'cancelled' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STATUS_PAID_MISMATCH');
  });
  it('data inválida', () => {
    const r = validateReceivable(routeReceivable({ effectiveDate: '2026-02-31' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_DATE');
  });
  it('timestamp inválido', () => {
    const r = validateReceivable(routeReceivable({ createdAtEpochMs: -1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TIMESTAMP');
  });
  it('timestamp não inteiro', () => {
    const r = validateReceivable(routeReceivable({ createdAtEpochMs: 1.5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TIMESTAMP');
  });
  it('route sem serviceId', () => {
    const r = validateReceivable(routeReceivable({ serviceId: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ROUTE_REQUIRES_SERVICE_ID');
  });
  it('route com serviceId inválido', () => {
    const r = validateReceivable(routeReceivable({ serviceId: 'svc_bad' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_SERVICE_ID');
  });
  it('manual com serviceId', () => {
    const r = validateReceivable(routeReceivable({ sourceType: 'manual' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MANUAL_HAS_SERVICE_ID');
  });
});

describe('remainingCents', () => {
  it('calcula amount - paid', () => {
    expect(remainingCents(routeReceivable({ paidCents: toCents(300), status: 'partial' })) as number).toBe(700);
  });
});

describe('applyAllocation', () => {
  it('alocação parcial → partial', () => {
    const r = applyAllocation(routeReceivable(), toCents(400));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.paidCents as number).toBe(400);
      expect(r.value.status).toBe('partial');
    }
  });
  it('alocação completa → paid', () => {
    const r = applyAllocation(routeReceivable(), toCents(1000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe('paid');
  });
  it('over-allocation rejeitada', () => {
    const r = applyAllocation(routeReceivable(), toCents(1001));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('OVER_ALLOCATION');
  });
  it('valor zero rejeitado', () => {
    const r = applyAllocation(routeReceivable(), toCents(0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
  it('inelegível (paid) rejeitado', () => {
    const r = applyAllocation(routeReceivable({ paidCents: toCents(1000), status: 'paid' }), toCents(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INELIGIBLE_STATUS');
  });
  it('não muta a entidade original', () => {
    const original = routeReceivable();
    applyAllocation(original, toCents(400));
    expect(original.paidCents as number).toBe(0);
    expect(original.status).toBe('open');
  });
});

describe('reverseAllocation', () => {
  it('reversão parcial → partial', () => {
    const r = reverseAllocation(routeReceivable({ paidCents: toCents(1000), status: 'paid' }), toCents(400));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.paidCents as number).toBe(600);
      expect(r.value.status).toBe('partial');
    }
  });
  it('reversão completa → open', () => {
    const r = reverseAllocation(routeReceivable({ paidCents: toCents(400), status: 'partial' }), toCents(400));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe('open');
  });
  it('reversão maior que paid rejeitada', () => {
    const r = reverseAllocation(routeReceivable({ paidCents: toCents(400), status: 'partial' }), toCents(500));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('OVER_REVERSAL');
  });
  it('cancelled rejeita reversão', () => {
    const r = reverseAllocation(routeReceivable({ status: 'cancelled' }), toCents(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CANCELLED');
  });
});

describe('cancelReceivable', () => {
  it('cancela aberto (paid == 0)', () => {
    const r = cancelReceivable(routeReceivable());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe('cancelled');
  });
  it('bloqueia se há pagamento (partial/paid)', () => {
    const r = cancelReceivable(routeReceivable({ paidCents: toCents(400), status: 'partial' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('HAS_PAYMENTS');
  });
  it('cancelar já cancelado é idempotente (sucesso)', () => {
    const r = cancelReceivable(routeReceivable({ status: 'cancelled' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe('cancelled');
  });
  it('não muta a entidade original', () => {
    const original = routeReceivable();
    cancelReceivable(original);
    expect(original.status).toBe('open');
  });
});
