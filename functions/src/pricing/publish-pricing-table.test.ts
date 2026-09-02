import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../src/shared/currency';
import {
  createPricingArea,
  parsePricingTablePaste,
  buildPricingAnalysisKey,
  buildIssueReferences,
  type PricingArea,
  type PricingImportDecision,
} from '../../../src/features/pricing/domain';
import { publishPricingTable, type PublishPricingTableInput, type PublishPricingTableDeps } from './publish-pricing-table';
import { Sha256RequestHasher } from './sha256-request-hasher';
import { FakeActiveTableReader, FakeIdGenerator, FakePublishTransaction } from './testing/fakes';
import type { ServerActiveTableSnapshot, CommitPublishRequest } from './ports';

function idOf(text: string, code: string, nth = 0): string {
  const parse = parsePricingTablePaste(text);
  if (!parse.ok) throw new Error('parse fatal');
  const kr = buildPricingAnalysisKey(text, parse);
  if (!kr.ok) throw new Error('key');
  const refs = buildIssueReferences(parse.issues, kr.key).filter((r) => r.code === code);
  if (!refs[nth]) throw new Error('issue não encontrada: ' + code);
  return refs[nth].issueId;
}
function area(id: string, name: string, cents: number, aliases?: string[]): PricingArea {
  const r = createPricingArea({ id, displayName: name, amountCents: toCents(cents) as Cents, aliases });
  if (!r.ok) throw new Error('area: ' + r.code);
  return r.value;
}
function snapshot(over: Partial<ServerActiveTableSnapshot> = {}): ServerActiveTableSnapshot {
  return { activeVersionId: null, revision: 0, areas: [], ...over };
}

const SPLIT_TEXT = 'R$10,00\nCentro\nNilson Veloso I e II';
function splitDecisions(): PricingImportDecision[] {
  return [{ kind: 'SplitGroupingIntoAreas', issueId: idOf(SPLIT_TEXT, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] }];
}
function input(over: Partial<PublishPricingTableInput> = {}): PublishPricingTableInput {
  return { uid: 'user-1', rawText: SPLIT_TEXT, decisions: splitDecisions(), expectedActiveVersionId: null, expectedRevision: 0, idempotencyKey: 'idem1234', ...over };
}
function deps(reader = FakeActiveTableReader.empty(), ids = new FakeIdGenerator(), transaction = FakePublishTransaction.ok(), hasher = new Sha256RequestHasher()): PublishPricingTableDeps & { reader: FakeActiveTableReader; ids: FakeIdGenerator; transaction: FakePublishTransaction; hasher: Sha256RequestHasher } {
  return { reader, ids, hasher, transaction };
}

describe('publishPricingTable (server-side)', () => {
  it('sucesso: reprocessa e publica com IDs novos pela porta', async () => {
    const d = deps();
    const r = await publishPricingTable(d, input());
    expect(r.state).toBe('published');
    if (r.state === 'published') {
      expect(r.revision).toBe(1);
      expect(r.idempotentReplay).toBe(false);
      expect(d.transaction.areaIdsOf(r.versionId).length).toBe(3); // Centro + 2 splits
    }
    expect(d.transaction.publishes).toBe(1);
    expect(d.ids.calls).toBe(3); // 3 itens novos
  });

  it('não confia no cliente: as áreas derivam do texto/decisões reprocessados no servidor', async () => {
    // ids esperados a partir das sementes idempotencyKey::nameNormalized (prova do reprocessamento)
    const gen = new FakeIdGenerator();
    const expected = ['centro', 'nilson veloso i', 'nilson veloso ii'].map((n) => gen.newAreaId('idem1234::' + n)).sort();
    const d = deps();
    const r = await publishPricingTable(d, input());
    expect(r.state).toBe('published');
    if (r.state === 'published') expect([...d.transaction.areaIdsOf(r.versionId)].sort()).toEqual(expected);
  });

  it('concorrência: expected divergente -> conflict, nada publicado', async () => {
    const d = deps(FakeActiveTableReader.empty(), new FakeIdGenerator(), FakePublishTransaction.ok({ activeVersionId: 'v0', revision: 2 }));
    const r = await publishPricingTable(d, input({ expectedActiveVersionId: null, expectedRevision: 0 }));
    expect(r.state).toBe('conflict');
    expect(d.transaction.publishes).toBe(0);
    expect(d.transaction.state.revision).toBe(2); // inalterado
  });

  it('idempotência ANTES da concorrência: 2º submit vira replay, não conflito', async () => {
    const tx = FakePublishTransaction.ok(); // avança para ver-1/rev1 após o 1º
    const ids = new FakeIdGenerator();
    const hasher = new Sha256RequestHasher();
    const reader = FakeActiveTableReader.empty();
    const first = await publishPricingTable({ reader, ids, hasher, transaction: tx }, input());
    // 2º submit com o MESMO expected (0/null) — a concorrência falharia (agora rev=1),
    // mas a idempotência é checada antes e devolve o resultado anterior.
    const second = await publishPricingTable({ reader, ids, hasher, transaction: tx }, input());
    expect(first.state).toBe('published');
    expect(second.state).toBe('published');
    if (second.state === 'published') expect(second.idempotentReplay).toBe(true);
    expect(tx.publishes).toBe(1); // UMA versão
    if (first.state === 'published') expect(tx.areaIdsOf(first.versionId).length).toBe(3); // sem duplicar áreas
  });

  it('mesma key + conteúdo diferente -> REQUEST_HASH_MISMATCH', async () => {
    const tx = FakePublishTransaction.ok();
    const reader = FakeActiveTableReader.empty();
    await publishPricingTable({ reader, ids: new FakeIdGenerator(), hasher: new Sha256RequestHasher(), transaction: tx }, input());
    const other = await publishPricingTable(
      { reader, ids: new FakeIdGenerator(), hasher: new Sha256RequestHasher(), transaction: tx },
      input({ rawText: 'R$99,00\nCentro\nNilson Veloso I e II' }),
    );
    expect(other.state).toBe('error');
    if (other.state === 'error') expect(other.code).toBe('REQUEST_HASH_MISMATCH');
    expect(tx.publishes).toBe(1);
  });

  it('requestHash armazenado é SHA-256 da canônica (nunca o JSON completo)', async () => {
    const d = deps();
    await publishPricingTable(d, input());
    const stored = d.transaction.storedRequestHash('idem1234');
    expect(stored).toMatch(/^[0-9a-f]{64}$/); // digest hex de 256 bits
    expect(stored).not.toContain('pricing-publish-request'); // não é o JSON canônico
    expect(stored).not.toContain('[');
    // determinístico e sensível ao conteúdo
    const same = new Sha256RequestHasher();
    const d2 = deps(FakeActiveTableReader.empty(), new FakeIdGenerator(), FakePublishTransaction.ok(), same);
    await publishPricingTable(d2, input());
    expect(d2.transaction.storedRequestHash('idem1234')).toBe(stored);
    const d3 = deps();
    await publishPricingTable(d3, input({ rawText: 'R$99,00\nCentro\nNilson Veloso I e II' }));
    expect(d3.transaction.storedRequestHash('idem1234')).not.toBe(stored);
  });

  it('retry direto da transação: mesmos versionId/areaIds e um único resultado lógico', async () => {
    const tx = FakePublishTransaction.ok();
    const req: CommitPublishRequest = {
      uid: 'u',
      idempotencyKey: 'idem1234',
      requestHash: new Sha256RequestHasher().hashCanonical('carga-canonica'),
      expectedActiveVersionId: null,
      expectedRevision: 0,
      plan: { uid: 'u', source: 'paste', items: [{ areaId: 'area_x', displayName: 'X', nameNormalized: 'x', aliases: [], amountCents: toCents(1000) as Cents }], previousVersionId: null },
    };
    const r1 = await tx.commit(req);
    const r2 = await tx.commit(req); // RETRY idêntico
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.versionId).toBe(r1.versionId);
      expect(r2.activationId).toBe(r1.activationId);
      expect(r1.idempotentReplay).toBe(false);
      expect(r2.idempotentReplay).toBe(true);
      expect(tx.areaIdsOf(r2.versionId)).toEqual(['area_x']);
    }
    expect(tx.publishes).toBe(1); // um único resultado lógico (uma versão)
    expect(tx.state.versions).toBe(1);
  });

  it('version divergente (revision igual) -> conflict', async () => {
    const d = deps(FakeActiveTableReader.empty(), new FakeIdGenerator(), FakePublishTransaction.ok({ activeVersionId: 'vX', revision: 0 }));
    const r = await publishPricingTable(d, input({ expectedActiveVersionId: null, expectedRevision: 0 }));
    expect(r.state).toBe('conflict');
    expect(d.transaction.publishes).toBe(0);
  });

  it('retries não geram IDs diferentes nem duplicam versões', async () => {
    const run = async () => {
      const d = deps();
      const r = await publishPricingTable(d, input());
      return r.state === 'published' ? [...d.transaction.areaIdsOf(r.versionId)].sort() : [];
    };
    const a = await run();
    const b = await run();
    expect(a).toEqual(b); // IDs idênticos entre execuções
    expect(a.length).toBe(3);
  });

  it('atomicidade: commit rejeitado não deixa estado parcial nem idempotência', async () => {
    const d = deps(FakeActiveTableReader.empty(), new FakeIdGenerator(), FakePublishTransaction.rejecting());
    const r = await publishPricingTable(d, input());
    expect(r.state).toBe('error');
    expect(d.transaction.publishes).toBe(0);
    expect(d.transaction.state).toEqual({ activeVersionId: null, revision: 0, versions: 0 });
    expect(d.transaction.storedRequestHash('idem1234')).toBeNull(); // nada gravado -> retry pode publicar

    // com uma transação sã, o mesmo envio publica normalmente (sem escrita parcial anterior)
    const ok = deps();
    const r2 = await publishPricingTable(ok, input());
    expect(r2.state).toBe('published');
    expect(ok.transaction.publishes).toBe(1);
  });

  it('entrada inválida -> invalid_input, sem ler nem publicar', async () => {
    const bad: PublishPricingTableInput[] = [
      input({ uid: '' }),
      input({ idempotencyKey: 'short' }),
      input({ expectedRevision: -1 }),
      input({ expectedActiveVersionId: 'a/b' }),
    ];
    for (const c of bad) {
      const d = deps();
      const r = await publishPricingTable(d, c);
      expect(r.state).toBe('invalid_input');
      expect(d.reader.loadCalls).toBe(0);
      expect(d.transaction.publishes).toBe(0);
    }
  });

  it('parser fatal / needs_reanalysis / resolution_invalid / review_required', async () => {
    const fatal = await publishPricingTable(deps(), input({ rawText: '' }));
    expect(fatal.state).toBe('invalid_input');
    if (fatal.state === 'invalid_input') expect(fatal.code).toBe('PARSER_FATAL');

    const needs = await publishPricingTable(deps(), input({ rawText: '20\nR$10,00\nCentro', decisions: [] }));
    expect(needs.state).toBe('needs_reanalysis');

    const resInvalid = await publishPricingTable(deps(), input({ rawText: 'R$10,00\nNilson Veloso I e II', decisions: [] }));
    expect(resInvalid.state).toBe('resolution_invalid');

    // diff ambíguo -> review_required
    const current = snapshot({ activeVersionId: 'v1', revision: 1, areas: [area('a1', 'Centro', 1000), area('a2', 'Centro Sul', 2000, ['centro'])] });
    const review = await publishPricingTable(
      deps(FakeActiveTableReader.withSnapshot(current)),
      input({ rawText: 'R$10,00\nCentro', decisions: [], expectedActiveVersionId: 'v1', expectedRevision: 1 }),
    );
    expect(review.state).toBe('review_required');
  });

  it('read_error quando a leitura falha', async () => {
    const failed = await publishPricingTable(deps(FakeActiveTableReader.failed()), input());
    expect(failed.state).toBe('read_error');
    const threw = await publishPricingTable(deps(FakeActiveTableReader.throwing()), input());
    expect(threw.state).toBe('read_error');
  });
});
