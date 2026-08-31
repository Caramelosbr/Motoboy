import { describe, it, expect } from 'vitest';
import { toCents } from '../../../shared/currency';
import type { Receivable } from '../../receivables/domain';
import { allocateFIFO, MAX_FIFO } from './index';

// Receivables "manual" (sem serviceId) para simplificar os fixtures do FIFO.
function rec(over: Partial<Receivable> & { id: string }): Receivable {
  return {
    clientId: 'c1',
    sourceType: 'manual',
    sourceId: 'src',
    description: 'conta',
    amountCents: toCents(1000),
    paidCents: toCents(0),
    status: 'open',
    effectiveDate: '2026-08-30',
    createdAtEpochMs: 1_756_000_000_000,
    ...over,
  };
}

describe('allocateFIFO — sucesso', () => {
  it('um recebível quitado exatamente', () => {
    const r = allocateFIFO([rec({ id: 'r1', amountCents: toCents(1000) })], toCents(1000));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.allocations).toEqual([{ receivableId: 'r1', amountCents: 1000 }]);
      expect(r.updatedReceivables[0].status).toBe('paid');
      expect(r.updatedReceivables).toHaveLength(1);
    }
  });

  it('pagamento parcial', () => {
    const r = allocateFIFO([rec({ id: 'r1', amountCents: toCents(1000) })], toCents(400));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.allocations).toEqual([{ receivableId: 'r1', amountCents: 400 }]);
      expect(r.updatedReceivables[0].status).toBe('partial');
      expect(r.updatedReceivables[0].paidCents as number).toBe(400);
    }
  });

  it('pagamento atravessando dois recebíveis', () => {
    const rs = [
      rec({ id: 'r1', amountCents: toCents(600), effectiveDate: '2026-08-01' }),
      rec({ id: 'r2', amountCents: toCents(600), effectiveDate: '2026-08-02' }),
    ];
    const r = allocateFIFO(rs, toCents(1000));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.allocations).toEqual([
        { receivableId: 'r1', amountCents: 600 },
        { receivableId: 'r2', amountCents: 400 },
      ]);
      expect(r.updatedReceivables[0].status).toBe('paid');
      expect(r.updatedReceivables[1].status).toBe('partial');
      const soma = r.allocations.reduce((s, a) => s + (a.amountCents as number), 0);
      expect(soma).toBe(1000);
    }
  });

  it('retorna somente os recebíveis afetados', () => {
    const rs = [
      rec({ id: 'r1', amountCents: toCents(500), effectiveDate: '2026-08-01' }),
      rec({ id: 'r2', amountCents: toCents(500), effectiveDate: '2026-08-02' }),
      rec({ id: 'r3', amountCents: toCents(500), effectiveDate: '2026-08-03' }),
    ];
    const r = allocateFIFO(rs, toCents(500)); // consome só o primeiro
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.updatedReceivables).toHaveLength(1);
      expect(r.updatedReceivables[0].id).toBe('r1');
    }
  });
});

describe('allocateFIFO — ordenação', () => {
  it('ordena por effectiveDate ascendente', () => {
    const rs = [
      rec({ id: 'b', effectiveDate: '2026-08-10' }),
      rec({ id: 'a', effectiveDate: '2026-08-01' }),
    ];
    const r = allocateFIFO(rs, toCents(2000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.allocations.map((a) => a.receivableId)).toEqual(['a', 'b']);
  });

  it('desempata por createdAtEpochMs', () => {
    const rs = [
      rec({ id: 'x', effectiveDate: '2026-08-01', createdAtEpochMs: 200 }),
      rec({ id: 'y', effectiveDate: '2026-08-01', createdAtEpochMs: 100 }),
    ];
    const r = allocateFIFO(rs, toCents(2000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.allocations.map((a) => a.receivableId)).toEqual(['y', 'x']);
  });

  it('desempata por id quando data e timestamp empatam', () => {
    const rs = [
      rec({ id: 'zzz', effectiveDate: '2026-08-01', createdAtEpochMs: 100 }),
      rec({ id: 'aaa', effectiveDate: '2026-08-01', createdAtEpochMs: 100 }),
    ];
    const r = allocateFIFO(rs, toCents(2000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.allocations.map((a) => a.receivableId)).toEqual(['aaa', 'zzz']);
  });

  it('nunca confia na ordem recebida (input desordenado)', () => {
    const rs = [
      rec({ id: 'c', effectiveDate: '2026-08-03' }),
      rec({ id: 'a', effectiveDate: '2026-08-01' }),
      rec({ id: 'b', effectiveDate: '2026-08-02' }),
    ];
    const r = allocateFIFO(rs, toCents(3000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.allocations.map((a) => a.receivableId)).toEqual(['a', 'b', 'c']);
  });
});

describe('allocateFIFO — imutabilidade', () => {
  it('não muta o array recebido', () => {
    const rs = [
      rec({ id: 'c', effectiveDate: '2026-08-03' }),
      rec({ id: 'a', effectiveDate: '2026-08-01' }),
    ];
    const ordemAntes = rs.map((r) => r.id);
    allocateFIFO(rs, toCents(2000));
    expect(rs.map((r) => r.id)).toEqual(ordemAntes); // ordem preservada
  });

  it('não muta as entidades originais', () => {
    const original = rec({ id: 'r1', amountCents: toCents(1000) });
    allocateFIFO([original], toCents(1000));
    expect(original.paidCents as number).toBe(0);
    expect(original.status).toBe('open');
  });
});

describe('allocateFIFO — falhas discriminadas', () => {
  it('valor zero → INVALID_AMOUNT', () => {
    const r = allocateFIFO([rec({ id: 'r1' })], toCents(0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
  it('sem recebíveis → EMPTY_RECEIVABLES', () => {
    const r = allocateFIFO([], toCents(100));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_RECEIVABLES');
  });
  it('clientes misturados → MIXED_CLIENTS', () => {
    const rs = [rec({ id: 'r1' }), rec({ id: 'r2', clientId: 'c2' })];
    const r = allocateFIFO(rs, toCents(1000));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MIXED_CLIENTS');
  });
  it('id duplicado → DUPLICATE_RECEIVABLE', () => {
    const rs = [rec({ id: 'r1' }), rec({ id: 'r1' })];
    const r = allocateFIFO(rs, toCents(1000));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_RECEIVABLE');
  });
  it('recebível paid → INELIGIBLE_RECEIVABLE', () => {
    const rs = [rec({ id: 'r1', paidCents: toCents(1000), status: 'paid' })];
    const r = allocateFIFO(rs, toCents(100));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INELIGIBLE_RECEIVABLE');
  });
  it('recebível cancelled → INELIGIBLE_RECEIVABLE', () => {
    const rs = [rec({ id: 'r1', status: 'cancelled' })];
    const r = allocateFIFO(rs, toCents(100));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INELIGIBLE_RECEIVABLE');
  });
  it('saldo insuficiente → INSUFFICIENT_BALANCE, sem resultado parcial', () => {
    const rs = [rec({ id: 'r1', amountCents: toCents(500) })];
    const r = allocateFIFO(rs, toCents(800));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INSUFFICIENT_BALANCE');
    expect(rs[0].paidCents as number).toBe(0); // original intacto
  });
});

describe('allocateFIFO — limites MAX_FIFO', () => {
  it('MAX_FIFO exportado é 100', () => {
    expect(MAX_FIFO).toBe(100);
  });
  it('100 recebíveis elegíveis são aceitos', () => {
    const rs = Array.from({ length: 100 }, (_v, i) =>
      rec({ id: 'r' + String(i).padStart(3, '0'), amountCents: toCents(100) }),
    );
    const r = allocateFIFO(rs, toCents(100)); // paga só o primeiro
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.updatedReceivables).toHaveLength(1);
  });
  it('101 recebíveis são rejeitados integralmente → MAX_FIFO_EXCEEDED', () => {
    const rs = Array.from({ length: 101 }, (_v, i) =>
      rec({ id: 'r' + String(i).padStart(3, '0'), amountCents: toCents(100) }),
    );
    const r = allocateFIFO(rs, toCents(100));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MAX_FIFO_EXCEEDED');
  });
});
