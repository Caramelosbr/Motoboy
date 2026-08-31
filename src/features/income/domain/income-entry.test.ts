import { describe, it, expect } from 'vitest';
import { toCents } from '../../../shared/currency';
import { validateIncomeEntry, type IncomeEntry } from './index';

function income(over: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 'i1',
    direction: 'credit',
    amountCents: toCents(1000),
    sourceType: 'payment',
    sourceId: 'p1',
    description: 'Recebimento',
    effectiveDate: '2026-08-30',
    ...over,
  };
}

describe('validateIncomeEntry', () => {
  it('payment credit', () => {
    expect(validateIncomeEntry(income()).ok).toBe(true);
  });
  it('payment debit (estorno de pagamento)', () => {
    expect(validateIncomeEntry(income({ direction: 'debit' })).ok).toBe(true);
  });
  it('manual credit', () => {
    expect(validateIncomeEntry(income({ sourceType: 'manual', sourceId: 'i1', direction: 'credit' })).ok).toBe(true);
  });
  it('manual debit com referência', () => {
    const e = income({
      sourceType: 'manual',
      direction: 'debit',
      sourceId: 'i2',
      reversesIncomeEntryId: 'i-original',
    });
    expect(validateIncomeEntry(e).ok).toBe(true);
  });
  it('manual debit sem referência → erro', () => {
    const r = validateIncomeEntry(income({ sourceType: 'manual', direction: 'debit', sourceId: 'i2' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MANUAL_DEBIT_MISSING_REVERSES_REF');
  });
  it('manual credit com referência indevida → erro', () => {
    const r = validateIncomeEntry(
      income({ sourceType: 'manual', direction: 'credit', reversesIncomeEntryId: 'x' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MANUAL_CREDIT_HAS_REVERSES_REF');
  });
  it('payment com referência de reversão → erro', () => {
    const r = validateIncomeEntry(income({ reversesIncomeEntryId: 'x' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PAYMENT_HAS_REVERSES_REF');
  });
  it('valor zero → erro', () => {
    const r = validateIncomeEntry(income({ amountCents: toCents(0) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
  it('data inválida → erro', () => {
    const r = validateIncomeEntry(income({ effectiveDate: '2026-02-30' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_DATE');
  });
  it('id/sourceId vazios → erro', () => {
    expect(validateIncomeEntry(income({ id: '' })).ok).toBe(false);
    expect(validateIncomeEntry(income({ sourceId: '' })).ok).toBe(false);
  });
});

describe('IncomeEntry — ausência de campos mutáveis', () => {
  it('não possui updatedAt nem cancelledAt', () => {
    const e = income();
    expect('updatedAt' in e).toBe(false);
    expect('cancelledAt' in e).toBe(false);
  });
});
