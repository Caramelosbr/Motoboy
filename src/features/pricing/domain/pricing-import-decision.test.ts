import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../shared/currency';
import {
  parsePricingTablePaste,
  buildPricingAnalysisKey,
  buildIssueReferences,
  validatePricingImportDecisions,
  MAX_PRICING_DISPLAY_NAME_LENGTH,
  type PricingPasteParseResult,
  type PricingImportDecision,
  type PricingIssueReference,
} from './index';

type CleanParse = Extract<PricingPasteParseResult, { ok: true }>;

interface Ctx {
  text: string;
  parse: CleanParse;
  key: string;
  refs: readonly PricingIssueReference[];
}
function analyze(text: string): Ctx {
  const parse = parsePricingTablePaste(text);
  if (!parse.ok) throw new Error('parse fatal inesperado');
  const kr = buildPricingAnalysisKey(text, parse);
  if (!kr.ok) throw new Error('key fatal');
  return { text, parse, key: kr.key, refs: buildIssueReferences(parse.issues, kr.key) };
}
function idOf(ctx: Ctx, code: string, nth = 0): string {
  const found = ctx.refs.filter((r) => r.code === code);
  if (!found[nth]) throw new Error('issue não encontrada: ' + code);
  return found[nth].issueId;
}
function run(ctx: Ctx, decisions: readonly PricingImportDecision[], key = ctx.key) {
  return validatePricingImportDecisions({ rawText: ctx.text, parse: ctx.parse, expectedAnalysisKey: key, decisions });
}
// Parse forjado (consistente com sua própria key) — usado só p/ casos que o parser real não produz.
function forge(text: string, over: Partial<CleanParse>): { text: string; parse: CleanParse; key: string } {
  const parse: CleanParse = { ok: true, items: [], groups: [], issues: [], unparsed: [], canPublish: false, ...over };
  const kr = buildPricingAnalysisKey(text, parse);
  if (!kr.ok) throw new Error('forge key fatal');
  return { text, parse, key: kr.key };
}
const item = (line: number, name: string, cents: number): CleanParse['items'][number] => ({
  lineNumber: line, rawLine: name, displayName: name, nameNormalized: name.toLowerCase(), amountCents: toCents(cents) as Cents, priceSource: 'group', groupIndex: 0,
});

describe('cobertura / stale / needs_reanalysis', () => {
  it('valid quando todas as issues são cobertas', () => {
    const ctx = analyze('R$10,00\nCentro\nCentro'); // DUPLICATE_IN_PASTE
    const r = run(ctx, [{ kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 2 }]);
    expect(r).toEqual({ ok: true, state: 'valid' });
  });
  it('MISSING_DECISION quando falta decisão', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = run(ctx, []);
    expect(r.ok).toBe(false);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('MISSING_DECISION');
  });
  it('UNKNOWN_ISSUE para issueId inexistente', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = run(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: 'issue:9:AMBIGUOUS_GROUPING:99' }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('UNKNOWN_ISSUE');
  });
  it('DUPLICATE_COVERAGE quando a mesma issue é coberta 2x', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const id = idOf(ctx, 'AMBIGUOUS_GROUPING');
    const r = run(ctx, [
      { kind: 'KeepGroupingAsSingleArea', issueId: id },
      { kind: 'KeepGroupingAsSingleArea', issueId: id },
    ]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('DUPLICATE_COVERAGE');
  });
  it('INCOMPATIBLE_DECISION quando o tipo não casa o código', () => {
    const ctx = analyze('R$10,00\nCentro\nCentro'); // DUPLICATE_IN_PASTE
    const r = run(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE') }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INCOMPATIBLE_DECISION');
  });
  it('STALE_ANALYSIS_KEY quando a chave diverge', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = run(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }], 'chave-antiga');
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('STALE_ANALYSIS_KEY');
  });
  it('needs_reanalysis tem prioridade sobre decisões faltantes', () => {
    const ctx = analyze('20\nR$10,00\nNilson Veloso I e II'); // AMBIGUOUS_PRICE_HEADER + AMBIGUOUS_GROUPING
    const r = run(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state).toBe('needs_reanalysis');
      if (r.state === 'needs_reanalysis') expect(r.blocking.some((b) => b.code === 'AMBIGUOUS_PRICE_HEADER')).toBe(true);
    }
  });
  it('decisão malformada -> INVALID_DECISION_PAYLOAD', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = run(ctx, [{ kind: 'Forjada' } as unknown as PricingImportDecision]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
});

describe('agrupamento', () => {
  it('manter como uma área', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    expect(run(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }]).ok).toBe(true);
  });
  it('split com 2 nomes', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const d: PricingImportDecision = { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] };
    expect(run(ctx, [d]).ok).toBe(true);
  });
  it('split com 1 nome rejeitado', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = run(ctx, [{ kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Só um'] }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
  it('nomes vazios / duplicados / acima do limite rejeitados', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const id = idOf(ctx, 'AMBIGUOUS_GROUPING');
    expect(run(ctx, [{ kind: 'SplitGroupingIntoAreas', issueId: id, names: ['A', '   '] }]).ok).toBe(false);
    expect(run(ctx, [{ kind: 'SplitGroupingIntoAreas', issueId: id, names: ['Igual', 'ÍGUAL'] }]).ok).toBe(false);
    expect(run(ctx, [{ kind: 'SplitGroupingIntoAreas', issueId: id, names: ['A', 'x'.repeat(MAX_PRICING_DISPLAY_NAME_LENGTH + 1)] }]).ok).toBe(false);
  });
  it('issue sem item/preço válido rejeita split (forjado)', () => {
    const f = forge('t', { issues: [{ code: 'AMBIGUOUS_GROUPING', lineNumber: 7, message: 'm' }], items: [] });
    const refs = buildIssueReferences(f.parse.issues, f.key);
    const r = validatePricingImportDecisions({ rawText: f.text, parse: f.parse, expectedAnalysisKey: f.key, decisions: [{ kind: 'SplitGroupingIntoAreas', issueId: refs[0].issueId, names: ['A', 'B'] }] });
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
});

describe('alias', () => {
  it('manter literal', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)');
    expect(run(ctx, [{ kind: 'KeepPossibleAliasLiteral', issueId: idOf(ctx, 'POSSIBLE_ALIAS') }]).ok).toBe(true);
  });
  it('registrar alias válido', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)');
    const d: PricingImportDecision = { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS'), targetLineNumber: 2, alias: 'Kowalski Velho' };
    expect(run(ctx, [d]).ok).toBe(true);
  });
  it('alias vazio / normaliza vazio / igual ao nome rejeitados', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)');
    const id = idOf(ctx, 'POSSIBLE_ALIAS');
    expect(run(ctx, [{ kind: 'RegisterAlias', issueId: id, targetLineNumber: 2, alias: '   ' }]).ok).toBe(false);
    expect(run(ctx, [{ kind: 'RegisterAlias', issueId: id, targetLineNumber: 2, alias: '---' }]).ok).toBe(false);
    expect(run(ctx, [{ kind: 'RegisterAlias', issueId: id, targetLineNumber: 2, alias: 'Milhão antiga Kowalski' }]).ok).toBe(false);
  });
  it('targetLineNumber inexistente rejeitado', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)');
    const r = run(ctx, [{ kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS'), targetLineNumber: 999, alias: 'Kowalski Velho' }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
  it('alias que coincide com item independente rejeitado', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)\nKowalski'); // Kowalski é item independente
    const r = run(ctx, [{ kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS'), targetLineNumber: 2, alias: 'Kowalski' }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
  it('KeepConflictSeparate cobre POSSIBLE_ALIAS + ALIAS_CONFLICT uma vez', () => {
    const ctx = analyze('R$15,00\nMilhão (antiga Kowalski)\nR$20,00\nKowalski');
    const d: PricingImportDecision = { kind: 'KeepConflictSeparate', issueIds: [idOf(ctx, 'POSSIBLE_ALIAS'), idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')] };
    expect(run(ctx, [d]).ok).toBe(true);
  });
  it('issue coberta de novo fora do cluster -> DUPLICATE_COVERAGE', () => {
    const ctx = analyze('R$15,00\nMilhão (antiga Kowalski)\nR$20,00\nKowalski');
    const pa = idOf(ctx, 'POSSIBLE_ALIAS');
    const r = run(ctx, [
      { kind: 'KeepConflictSeparate', issueIds: [pa, idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')] },
      { kind: 'KeepPossibleAliasLiteral', issueId: pa },
    ]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('DUPLICATE_COVERAGE');
  });
  it('cluster misturando conflitos diferentes -> INVALID_CONFLICT_CLUSTER', () => {
    const ctx = analyze('R$15,00\nA (antiga X)\nR$20,00\nX\nR$15,00\nB (antiga Y)\nR$20,00\nY');
    const conflicts = ctx.refs.filter((r) => r.code === 'ALIAS_CONFLICT_IN_PASTE');
    const r = run(ctx, [{ kind: 'KeepConflictSeparate', issueIds: [conflicts[0].issueId, conflicts[1].issueId] }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_CONFLICT_CLUSTER');
  });
});

describe('duplicidades', () => {
  it('consolidação escolhendo linha candidata', () => {
    const ctx = analyze('R$10,00\nCentro\nCentro');
    expect(run(ctx, [{ kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 3 }]).ok).toBe(true);
  });
  it('linha fora dos candidatos rejeitada', () => {
    const ctx = analyze('R$10,00\nCentro\nCentro');
    const r = run(ctx, [{ kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 99 }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
  it('ChooseDuplicateVariant escolhe candidata existente', () => {
    const ctx = analyze('R$10,00\nCentro\nR$20,00\nCentro');
    expect(run(ctx, [{ kind: 'ChooseDuplicateVariant', issueId: idOf(ctx, 'DUPLICATE_WITH_DIFFERENT_PRICE'), keepLineNumber: 2 }]).ok).toBe(true);
  });
  it('DUPLICATE_IN_PASTE forjado com preços diferentes rejeita consolidação', () => {
    const f = forge('t', {
      items: [item(1, 'Centro', 1000), item(2, 'Centro', 2000)],
      issues: [{ code: 'DUPLICATE_IN_PASTE', lineNumber: 1, lineNumbers: [1, 2], message: 'm' }],
    });
    const refs = buildIssueReferences(f.parse.issues, f.key);
    const r = validatePricingImportDecisions({ rawText: f.text, parse: f.parse, expectedAnalysisKey: f.key, decisions: [{ kind: 'ConsolidateDuplicate', issueId: refs[0].issueId, keepLineNumber: 1 }] });
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
  it('DUPLICATE_WITH_DIFFERENT_PRICE forjado sem 2 preços distintos rejeita variante', () => {
    const f = forge('t', {
      items: [item(1, 'Centro', 1000), item(2, 'Centro', 1000)],
      issues: [{ code: 'DUPLICATE_WITH_DIFFERENT_PRICE', lineNumber: 1, lineNumbers: [1, 2], message: 'm' }],
    });
    const refs = buildIssueReferences(f.parse.issues, f.key);
    const r = validatePricingImportDecisions({ rawText: f.text, parse: f.parse, expectedAnalysisKey: f.key, decisions: [{ kind: 'ChooseDuplicateVariant', issueId: refs[0].issueId, keepLineNumber: 1 }] });
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
});

describe('unparsed (parse forjado consistente)', () => {
  function unparsedCtx() {
    const f = forge('linha ruim', { issues: [{ code: 'UNPARSED_LINE', lineNumber: 1, message: 'm' }], unparsed: [{ lineNumber: 1, rawLine: 'linha ruim' }] });
    const refs = buildIssueReferences(f.parse.issues, f.key);
    return { f, id: refs[0].issueId };
  }
  it('exclusão válida', () => {
    const { f, id } = unparsedCtx();
    const r = validatePricingImportDecisions({ rawText: f.text, parse: f.parse, expectedAnalysisKey: f.key, decisions: [{ kind: 'ExcludeLine', issueId: id, lineNumber: 1, reason: 'lixo do WhatsApp' }] });
    expect(r).toEqual({ ok: true, state: 'valid' });
  });
  it('justificativa vazia rejeitada', () => {
    const { f, id } = unparsedCtx();
    const r = validatePricingImportDecisions({ rawText: f.text, parse: f.parse, expectedAnalysisKey: f.key, decisions: [{ kind: 'ExcludeLine', issueId: id, lineNumber: 1, reason: '   ' }] });
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
  it('linha não presente em unparsed rejeitada', () => {
    const f = forge('t', { items: [item(1, 'Centro', 1000)], issues: [{ code: 'UNPARSED_LINE', lineNumber: 1, message: 'm' }], unparsed: [] });
    const refs = buildIssueReferences(f.parse.issues, f.key);
    const r = validatePricingImportDecisions({ rawText: f.text, parse: f.parse, expectedAnalysisKey: f.key, decisions: [{ kind: 'ExcludeLine', issueId: refs[0].issueId, lineNumber: 1, reason: 'x' }] });
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('INVALID_DECISION_PAYLOAD');
  });
});

describe('issueId determinístico', () => {
  it('duas issues iguais nas mesmas linhas recebem ids diferentes pelo índice', () => {
    const key = 'k';
    const refs = buildIssueReferences(
      [{ code: 'POSSIBLE_ALIAS', lineNumber: 5, message: 'm' }, { code: 'POSSIBLE_ALIAS', lineNumber: 5, message: 'm' }],
      key,
    );
    expect(refs[0].issueId).not.toBe(refs[1].issueId);
    expect(refs[0].issueId).toContain(':0:');
    expect(refs[1].issueId).toContain(':1:');
  });
  it('lineNumbers é copiado (não muta a entrada)', () => {
    const lines = [2, 3];
    const issue = { code: 'DUPLICATE_IN_PASTE' as const, lineNumber: 2, lineNumbers: lines, message: 'm' };
    const refs = buildIssueReferences([issue], 'k');
    expect(refs[0].lineNumbers).not.toBe(lines);
    expect(lines).toEqual([2, 3]);
  });
});

describe('lista real (51 itens) -> decisões válidas', () => {
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
  it('51 itens; dois splits + KeepConflictSeparate -> valid (nada aplicado ainda)', () => {
    const ctx = analyze(buildList());
    expect(ctx.parse.items.length).toBe(51);
    // os dois "I e II" estão no grupo R$15 = 1500
    const groupingRefs = ctx.refs.filter((r) => r.code === 'AMBIGUOUS_GROUPING');
    expect(groupingRefs.length).toBe(2);
    for (const g of groupingRefs) {
      const it = ctx.parse.items.find((i) => i.lineNumber === g.lineNumber);
      expect(it?.amountCents as number).toBe(1500);
    }
    // Milhão 1500, Kowalski 2000, separados
    const byName = new Map(ctx.parse.items.map((i) => [i.nameNormalized, i]));
    expect(byName.get('milhao antiga kowalski')?.amountCents as number).toBe(1500);
    expect(byName.get('kowalski')?.amountCents as number).toBe(2000);

    const decisions: PricingImportDecision[] = [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 0), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 1), names: ['Condomínio Flamboyant I', 'Condomínio Flamboyant II'] },
      { kind: 'KeepConflictSeparate', issueIds: [idOf(ctx, 'POSSIBLE_ALIAS'), idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')] },
    ];
    const r = run(ctx, decisions);
    expect(r).toEqual({ ok: true, state: 'valid' });
    // DEC-020.3B-2 deverá produzir 53 áreas; nesta etapa nada é aplicado (segue 51).
    expect(ctx.parse.items.length).toBe(51);
  });
});
