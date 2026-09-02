import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../../shared/currency';
import { createPricingArea, type ResolvedPricingDiffResult, type ResolvedPricingItem, type PricingArea } from '../../domain';
import { publishResolvedPricingTable, type PublishResolvedPricingInput } from './publish-resolved-pricing';
import { FakePricingPublishGateway } from '../testing/fake-pricing-publish-gateway';
import type {
  PricingPublishGateway,
  PublishPricingRequest,
  PublishGatewayResult,
} from '../ports/pricing-publish-gateway';

const item = (name: string, cents: number): ResolvedPricingItem => ({
  displayName: name,
  nameNormalized: name.toLowerCase(),
  aliases: [],
  amountCents: toCents(cents) as Cents,
  provenance: { sourceLineNumbers: [1], sourceIssueIds: [] },
});
function area(id: string, name: string, cents: number, aliases?: string[]): PricingArea {
  const r = createPricingArea({ id, displayName: name, amountCents: toCents(cents) as Cents, aliases });
  if (!r.ok) throw new Error('area inválida: ' + r.code);
  return r.value;
}

function okDiff(): ResolvedPricingDiffResult {
  return {
    ok: true,
    analysisKey: 'k',
    newItems: [{ proposed: item('Bairro Novo', 1000) }],
    changed: [],
    removed: [],
    unchanged: [],
    conflicts: [],
    excludedLines: [],
    counts: { new: 1, changed: 0, removed: 0, unchanged: 0, conflicts: 0 },
    canPublish: true,
  };
}
function conflictDiff(): ResolvedPricingDiffResult {
  return {
    ok: true,
    analysisKey: 'k',
    newItems: [],
    changed: [],
    removed: [],
    unchanged: [],
    conflicts: [{ proposed: item('X', 1000), candidates: [] }],
    excludedLines: [],
    counts: { new: 0, changed: 0, removed: 0, unchanged: 0, conflicts: 1 },
    canPublish: false,
  };
}
function input(over: Partial<PublishResolvedPricingInput> = {}): PublishResolvedPricingInput {
  return { diff: okDiff(), expectedActiveVersionId: 'v1', expectedRevision: 3, idempotencyKey: 'abcd1234', requestHash: 'hash-abcdefgh', ...over };
}

describe('publishResolvedPricingTable', () => {
  it('sucesso -> published com confirmação durável', async () => {
    const gw = FakePricingPublishGateway.ok();
    const r = await publishResolvedPricingTable(gw, input());
    expect(r.state).toBe('published');
    if (r.state === 'published') {
      expect(r.versionId).toBe('v1');
      expect(r.revision).toBe(4); // expectedRevision + 1
      expect(r.activationId).toBe('act1');
      expect(r.idempotentReplay).toBe(false);
    }
    expect(gw.publishes).toBe(1);
  });

  it('conflito -> CONCURRENT_MODIFICATION, nada publicado', async () => {
    const gw = FakePricingPublishGateway.conflict();
    const r = await publishResolvedPricingTable(gw, input());
    expect(r.state).toBe('conflict');
    if (r.state === 'conflict') expect(r.code).toBe('CONCURRENT_MODIFICATION');
    expect(gw.publishes).toBe(0);
  });

  it('falha do gateway -> error (rejeição/exceção) e offline', async () => {
    const rejected = await publishResolvedPricingTable(FakePricingPublishGateway.rejected(), input());
    expect(rejected.state).toBe('error');
    if (rejected.state === 'error') expect(rejected.code).toBe('REJECTED');

    const thrown = await publishResolvedPricingTable(FakePricingPublishGateway.throwing(), input());
    expect(thrown.state).toBe('error');

    const offline = await publishResolvedPricingTable(FakePricingPublishGateway.offline(), input());
    expect(offline.state).toBe('offline');
  });

  it('duplo clique -> uma publicação efetiva; segundo é replay idempotente', async () => {
    const gw = FakePricingPublishGateway.ok();
    const first = await publishResolvedPricingTable(gw, input());
    const second = await publishResolvedPricingTable(gw, input()); // mesma key + hash
    expect(first.state).toBe('published');
    expect(second.state).toBe('published');
    if (first.state === 'published') expect(first.idempotentReplay).toBe(false);
    if (second.state === 'published') expect(second.idempotentReplay).toBe(true);
    expect(gw.publishes).toBe(1); // UMA versão
    expect(gw.calls).toBe(2);

    // mesma chave + hash diferente -> conflito de idempotência
    const mismatch = await publishResolvedPricingTable(gw, input({ requestHash: 'outro-hash-1234' }));
    expect(mismatch.state).toBe('error');
    if (mismatch.state === 'error') expect(mismatch.code).toBe('REQUEST_HASH_MISMATCH');
    expect(gw.publishes).toBe(1); // continua UMA
  });

  it('payload inválido -> invalid_payload sem chamar o gateway', async () => {
    const cases: PublishResolvedPricingInput[] = [
      input({ diff: conflictDiff() }), // diff com conflito / canPublish false
      input({ idempotencyKey: 'short' }), // formato inválido
      input({ expectedRevision: -1 }), // revisão inválida
      input({ expectedActiveVersionId: '' }), // ponteiro vazio
    ];
    for (const c of cases) {
      const gw = FakePricingPublishGateway.ok();
      const r = await publishResolvedPricingTable(gw, c);
      expect(r.state).toBe('invalid_payload');
      expect(gw.calls).toBe(0); // gateway nunca chamado
    }
  });

  it('mais campos inválidos -> invalid_payload sem chamar o gateway; null é aceito', async () => {
    const bad: PublishResolvedPricingInput[] = [
      input({ requestHash: 'x' }), // hash curto/ inválido
      input({ expectedActiveVersionId: 'a/b' }), // ponteiro com "/"
      input({ expectedRevision: 1.5 }), // revisão não inteira
      input({ expectedRevision: Number.NaN }), // revisão NaN
      input({ idempotencyKey: 'x'.repeat(200) }), // key acima do limite
    ];
    for (const c of bad) {
      const gw = FakePricingPublishGateway.ok();
      const r = await publishResolvedPricingTable(gw, c);
      expect(r.state).toBe('invalid_payload');
      expect(gw.calls).toBe(0);
    }
    // expectedActiveVersionId null é válido (primeira publicação) -> publica
    const gwOk = FakePricingPublishGateway.ok();
    const r = await publishResolvedPricingTable(gwOk, input({ expectedActiveVersionId: null }));
    expect(r.state).toBe('published');
  });

  it('diff com falha (não ok) -> invalid_payload, gateway 0 chamadas', async () => {
    const gw = FakePricingPublishGateway.ok();
    const diffErr: ResolvedPricingDiffResult = { ok: false, code: 'INVALID_RESOLVED_PROPOSAL', message: 'x' };
    const r = await publishResolvedPricingTable(gw, input({ diff: diffErr }));
    expect(r.state).toBe('invalid_payload');
    expect(gw.calls).toBe(0);
  });

  it('ack malformado (durable !== true) -> nunca published', async () => {
    const gw: PricingPublishGateway = {
      publish: async () =>
        ({ ok: true, durable: false, versionId: 'v', revision: 1, activationId: 'a', idempotentReplay: false } as unknown as PublishGatewayResult),
    };
    const r = await publishResolvedPricingTable(gw, input());
    expect(r.state).not.toBe('published');
    expect(r.state).toBe('error');
  });

  it('encaminha o payload exato e não muta o diff', async () => {
    let captured: PublishPricingRequest | null = null;
    const gw: PricingPublishGateway = {
      publish: async (req) => {
        captured = req;
        return { ok: true, durable: true, versionId: 'v1', revision: req.expectedRevision + 1, activationId: 'act1', idempotentReplay: false };
      },
    };
    const diff: ResolvedPricingDiffResult = {
      ok: true,
      analysisKey: 'k',
      newItems: [{ proposed: item('Sul', 4000) }],
      changed: [
        { areaId: 'a1', current: area('a1', 'Centro', 1000, ['velho']), proposed: item('Centro', 2000), matchedBy: 'name', amountChanged: true, displayNameChanged: false, aliasesAdded: ['novo'], aliasesResult: ['velho', 'novo'] },
      ],
      unchanged: [{ areaId: 'a2', current: area('a2', 'Norte', 3000, ['n1']), proposed: item('Norte', 3000), matchedBy: 'name' }],
      removed: [{ area: area('a9', 'Extinto', 999) }],
      conflicts: [],
      excludedLines: [{ lineNumber: 7, rawLine: 'lixo', reason: 'x', issueId: 'issue:0:UNPARSED_LINE:7' }],
      counts: { new: 1, changed: 1, removed: 1, unchanged: 1, conflicts: 0 },
      canPublish: true,
    };
    const snap = JSON.stringify(diff);
    const r = await publishResolvedPricingTable(gw, input({ diff, expectedRevision: 5 }));
    expect(r.state).toBe('published');
    const req = captured as unknown as PublishPricingRequest;
    expect(req.idempotencyKey).toBe('abcd1234');
    expect(req.requestHash).toBe('hash-abcdefgh');
    expect(req.expectedActiveVersionId).toBe('v1');
    expect(req.expectedRevision).toBe(5);
    expect(req.excludedLines).toEqual([{ lineNumber: 7, rawLine: 'lixo', reason: 'x', issueId: 'issue:0:UNPARSED_LINE:7' }]);
    expect(req.items).toEqual([
      { areaId: 'a1', displayName: 'Centro', nameNormalized: 'centro', aliases: ['velho', 'novo'], amountCents: 2000 },
      { areaId: 'a2', displayName: 'Norte', nameNormalized: 'norte', aliases: ['n1'], amountCents: 3000 },
      { areaId: null, displayName: 'Sul', nameNormalized: 'sul', aliases: [], amountCents: 4000 },
    ]);
    expect(req.items.some((i) => i.displayName === 'Extinto')).toBe(false); // removidos não vão no payload
    expect(JSON.stringify(diff)).toBe(snap); // diff de entrada intacto
  });

  it('duplo clique: o use-case sempre encaminha ao gateway (replay/conflito vêm do gateway)', async () => {
    let calls = 0;
    const gw: PricingPublishGateway = {
      publish: async () => {
        calls += 1;
        return { ok: false, code: 'CONCURRENT_MODIFICATION', message: 'm' };
      },
    };
    const a = await publishResolvedPricingTable(gw, input());
    const b = await publishResolvedPricingTable(gw, input());
    expect(calls).toBe(2); // encaminhou nas duas; nada inventado localmente
    expect(a.state).toBe('conflict');
    expect(b.state).toBe('conflict');
  });
});
