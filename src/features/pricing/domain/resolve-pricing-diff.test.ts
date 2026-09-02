import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../shared/currency';
import {
  createPricingArea,
  normalizePricingName,
  diffResolvedPricingTable,
  parsePricingTablePaste,
  buildPricingAnalysisKey,
  buildIssueReferences,
  resolvePricingProposal,
  type PricingArea,
  type ResolvedPricingItem,
  type ResolvedPricingProposal,
  type ResolvedPricingDiffResult,
  type PricingImportDecision,
} from './index';

function area(id: string, name: string, cents: number, aliases?: string[]): PricingArea {
  const r = createPricingArea({ id, displayName: name, amountCents: toCents(cents) as Cents, aliases });
  if (!r.ok) throw new Error('area inválida: ' + r.code);
  return r.value;
}
function ritem(name: string, cents: number, aliases: string[] = []): ResolvedPricingItem {
  return {
    displayName: name,
    nameNormalized: normalizePricingName(name),
    aliases,
    amountCents: toCents(cents) as Cents,
    provenance: { sourceLineNumbers: [1], sourceIssueIds: [] },
  };
}
function proposal(items: ResolvedPricingItem[], analysisKey = 'k', excludedLines: ResolvedPricingProposal['excludedLines'] = []): ResolvedPricingProposal {
  return { analysisKey, items, excludedLines, appliedIssueIds: [] };
}
function diff(current: PricingArea[], prop: ResolvedPricingProposal): ResolvedPricingDiffResult {
  return diffResolvedPricingTable({ currentAreas: current, proposal: prop });
}
function ok(r: ResolvedPricingDiffResult) {
  if (!r.ok) throw new Error('esperava ok, veio ' + JSON.stringify(r));
  return r;
}

describe('identidade e categorias', () => {
  it('unchanged reaproveita areaId por nome', () => {
    const r = ok(diff([area('a1', 'Centro', 1000)], proposal([ritem('Centro', 1000)])));
    expect(r.unchanged.length).toBe(1);
    expect(r.unchanged[0].areaId).toBe('a1');
    expect(r.counts).toEqual({ new: 0, changed: 0, removed: 0, unchanged: 1, conflicts: 0 });
  });
  it('changed por preço mantém o mesmo areaId', () => {
    const r = ok(diff([area('a1', 'Centro', 1000)], proposal([ritem('Centro', 2000)])));
    expect(r.changed.length).toBe(1);
    expect(r.changed[0].areaId).toBe('a1');
    expect(r.changed[0].amountChanged).toBe(true);
  });
  it('reaproveita areaId por alias (matchedBy alias)', () => {
    // item com nome distinto mas alias explícito == alias da área -> casa por alias
    const r = ok(diff([area('a2', 'Milhão', 1500, ['kowalski'])], proposal([ritem('Milhão Central', 1500, ['kowalski'])])));
    const hit = [...r.changed, ...r.unchanged].find((x) => x.areaId === 'a2');
    expect(hit?.matchedBy).toBe('alias');
  });
  it('new nunca recebe id; removed para área não casada', () => {
    const r = ok(diff([area('a1', 'Antigo', 1000)], proposal([ritem('Bairro Novo', 1000)])));
    expect(r.newItems.length).toBe(1);
    expect('id' in r.newItems[0].proposed).toBe(false);
    expect(r.removed.map((x) => x.area.id)).toEqual(['a1']);
  });
});

describe('aliases: adição visível, metadata preservada', () => {
  it('alias novo -> changed com aliasesAdded e união, sem descartar o antigo', () => {
    const r = ok(diff([area('a1', 'Centro', 1000, ['velho'])], proposal([ritem('Centro', 1000, ['novo'])])));
    expect(r.changed.length).toBe(1);
    expect(r.changed[0].amountChanged).toBe(false);
    expect(r.changed[0].aliasesAdded).toEqual(['novo']);
    expect(r.changed[0].aliasesResult).toEqual(['velho', 'novo']); // antigo preservado
  });
  it('alias já existente não gera mudança (unchanged)', () => {
    const r = ok(diff([area('a1', 'Centro', 1000, ['velho'])], proposal([ritem('Centro', 1000, ['velho'])])));
    // "velho" também casa a área por alias; sem preço/nome/alias novos -> unchanged
    expect(r.unchanged.length).toBe(1);
    expect(r.changed.length).toBe(0);
  });
  it('união de aliases acima do limite -> INVALID_MERGED_ALIASES', () => {
    const existing = Array.from({ length: 10 }, (_, i) => 'al' + i);
    const r = diff([area('a1', 'Centro', 1000, existing)], proposal([ritem('Centro', 1000, ['extra'])]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_MERGED_ALIASES');
  });
});

describe('conflitos (nunca resolve sozinho)', () => {
  it('match ambíguo -> conflict e canPublish false', () => {
    const r = ok(diff([area('a1', 'Centro', 1000), area('a2', 'Norte', 2000)], proposal([ritem('Centro', 1000, ['norte'])])));
    expect(r.conflicts.length).toBe(1);
    expect(r.canPublish).toBe(false);
  });
  it('dois itens reivindicando a mesma área -> conflitos', () => {
    const cur = [area('a1', 'Milhão', 1500, ['kowalski'])];
    const r = ok(diff(cur, proposal([ritem('Milhão', 1500), ritem('Kowalski', 2000)])));
    expect(r.conflicts.length).toBe(2);
    expect(r.canPublish).toBe(false);
  });
});

describe('defesa de fronteira', () => {
  it('proposta inválida -> INVALID_RESOLVED_PROPOSAL', () => {
    const bad = proposal([{ ...ritem('Centro', 1000), amountCents: 0 as Cents }]);
    const r = diff([], bad);
    if (!r.ok) expect(r.code).toBe('INVALID_RESOLVED_PROPOSAL');
    else throw new Error('esperava erro');
  });
  it('tabela ativa inválida -> INVALID_CURRENT_TABLE', () => {
    const invalid = { ...area('a1', 'Centro', 1000), amountCents: 0 as Cents } as PricingArea;
    const r = diff([invalid], proposal([ritem('Centro', 1000)]));
    if (!r.ok) expect(r.code).toBe('INVALID_CURRENT_TABLE');
    else throw new Error('esperava erro');
  });
  it('IDs duplicados na tabela -> DUPLICATE_CURRENT_ID', () => {
    const r = diff([area('a1', 'Centro', 1000), area('a1', 'Outro', 2000)], proposal([ritem('Centro', 1000)]));
    if (!r.ok) expect(r.code).toBe('DUPLICATE_CURRENT_ID');
    else throw new Error('esperava erro');
  });
});

describe('determinismo e imutabilidade', () => {
  it('mesmo resultado em duas execuções; entradas não mutadas', () => {
    const cur = [area('a1', 'Centro', 1000), area('a2', 'Norte', 2000)];
    const prop = proposal([ritem('Centro', 1500), ritem('Sul', 3000)]);
    const snapCur = JSON.stringify(cur);
    const snapProp = JSON.stringify(prop);
    const a = diff(cur, prop);
    const b = diff(cur, prop);
    expect(a).toEqual(b);
    expect(JSON.stringify(cur)).toBe(snapCur);
    expect(JSON.stringify(prop)).toBe(snapProp);
  });
});

describe('lista real (53) x tabela ativa fictícia', () => {
  function buildList(): string {
    const L: string[] = ['R$12,00:'];
    for (let i = 1; i <= 17; i += 1) L.push('• Setor Doze ' + String(i).padStart(2, '0'));
    L.push('R$15,00:', '• Milhão (antiga Kowalski)', '• Nilson Veloso I e II', '• Condomínio Flamboyant I e II');
    for (let i = 1; i <= 8; i += 1) L.push('* Setor Quinze ' + String(i).padStart(2, '0'));
    L.push('R$20,00:', '* santa clara', '- Kowalski');
    for (let i = 1; i <= 18; i += 1) L.push('- Setor Vinte ' + String(i).padStart(2, '0'));
    L.push('R$25,00:', '• Décio 060', '• Zona 2501', '• Zona 2502');
    return L.join('\n');
  }
  it('categorias coerentes, ids preservados, sem id inventado, excludedLines vazio', () => {
    const text = buildList();
    const parse = parsePricingTablePaste(text);
    if (!parse.ok) throw new Error('parse');
    const kr = buildPricingAnalysisKey(text, parse);
    if (!kr.ok) throw new Error('key');
    const refs = buildIssueReferences(parse.issues, kr.key);
    const id = (code: string, nth = 0) => refs.filter((r) => r.code === code)[nth].issueId;
    const decisions: PricingImportDecision[] = [
      { kind: 'SplitGroupingIntoAreas', issueId: id('AMBIGUOUS_GROUPING', 0), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
      { kind: 'SplitGroupingIntoAreas', issueId: id('AMBIGUOUS_GROUPING', 1), names: ['Condomínio Flamboyant I', 'Condomínio Flamboyant II'] },
      { kind: 'KeepConflictSeparate', issueIds: [id('POSSIBLE_ALIAS'), id('ALIAS_CONFLICT_IN_PASTE')] },
    ];
    const res = resolvePricingProposal({ rawText: text, expectedAnalysisKey: kr.key, decisions });
    if (!(res.ok && res.state === 'resolved')) throw new Error('esperava resolved');
    expect(res.proposal.items.length).toBe(53);

    const current = [
      area('id-doze01', 'Setor Doze 01', 1200), // unchanged
      area('id-doze02', 'Setor Doze 02', 1000), // changed (proposta 1200)
      area('id-kow', 'Kowalski', 2000), // unchanged
      area('id-extinto', 'Bairro Extinto', 999), // removed
    ];
    const r = ok(diff(current, res.proposal));
    expect(r.counts.unchanged).toBe(2);
    expect(r.counts.changed).toBe(1);
    expect(r.counts.removed).toBe(1);
    expect(r.counts.new).toBe(50);
    expect(r.counts.conflicts).toBe(0);
    expect(r.canPublish).toBe(true);
    expect(r.changed[0].areaId).toBe('id-doze02'); // id preservado
    expect(r.newItems.every((n) => !('id' in n.proposed))).toBe(true); // sem id inventado
    expect(r.excludedLines).toEqual([]);
    expect(r.analysisKey).toBe(kr.key);
  });
});
