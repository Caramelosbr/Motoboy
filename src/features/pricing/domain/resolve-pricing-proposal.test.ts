import { describe, it, expect } from 'vitest';
import {
  parsePricingTablePaste,
  buildPricingAnalysisKey,
  buildIssueReferences,
  resolvePricingProposal,
  type PricingPasteParseResult,
  type PricingImportDecision,
  type PricingIssueReference,
  type PricingProposalResolutionResult,
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
function resolve(ctx: Ctx, decisions: readonly PricingImportDecision[], key = ctx.key): PricingProposalResolutionResult {
  return resolvePricingProposal({ rawText: ctx.text, expectedAnalysisKey: key, decisions });
}
function resolved(r: PricingProposalResolutionResult) {
  if (!(r.ok && r.state === 'resolved')) throw new Error('esperava resolved, veio ' + JSON.stringify(r));
  return r.proposal;
}

// ---------- 1. Reparse interno ----------

describe('reparse interno', () => {
  it('texto alterado (chave de outro texto) -> STALE_ANALYSIS_KEY', () => {
    const a = analyze('R$10,00\nNilson Veloso I e II');
    const b = analyze('R$10,00\nOutro Bairro');
    const r = resolvePricingProposal({
      rawText: a.text,
      expectedAnalysisKey: b.key, // chave de OUTRO texto
      decisions: [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(a, 'AMBIGUOUS_GROUPING') }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('STALE_ANALYSIS_KEY');
  });
  it('parse fatal -> invalid_input com fatalCode', () => {
    const r = resolvePricingProposal({ rawText: '', expectedAnalysisKey: 'x', decisions: [] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.state === 'invalid_input') expect(r.fatalCode).toBe('EMPTY_INPUT');
  });
  it('a função reparseia (usa as issues do texto passado, não de outro)', () => {
    const ctx = analyze('R$10,00\nCentro\nCentro'); // DUPLICATE_IN_PASTE
    const p = resolved(resolve(ctx, [{ kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 2 }]));
    expect(p.items.length).toBe(1);
    expect(p.items[0].nameNormalized).toBe('centro');
  });
});

// ---------- 2. Estados ----------

describe('estados discriminados', () => {
  it('needs_reanalysis preserva as issues bloqueantes', () => {
    const ctx = analyze('20\nR$10,00\nNilson Veloso I e II'); // AMBIGUOUS_PRICE_HEADER
    const r = resolve(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }]);
    expect(r.ok).toBe(false);
    if (!r.ok && r.state === 'needs_reanalysis') {
      expect(r.blocking.some((b) => b.code === 'AMBIGUOUS_PRICE_HEADER')).toBe(true);
    } else {
      throw new Error('esperava needs_reanalysis');
    }
  });
  it('resolution_invalid quando falta decisão (MISSING_DECISION)', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = resolve(ctx, []);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('MISSING_DECISION');
    else throw new Error('esperava resolution_invalid');
  });
  it('resolved quando tudo é coberto', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const r = resolve(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }]);
    expect(r.ok && r.state === 'resolved').toBe(true);
  });
  it('nenhum estado de erro carrega proposta parcial', () => {
    const fatal = resolvePricingProposal({ rawText: '', expectedAnalysisKey: 'x', decisions: [] });
    const stale = resolvePricingProposal({ rawText: 'R$10,00\nCentro', expectedAnalysisKey: 'errada', decisions: [] });
    const missing = resolve(analyze('R$10,00\nNilson Veloso I e II'), []);
    for (const r of [fatal, stale, missing]) {
      expect(r.ok).toBe(false);
      expect('proposal' in r).toBe(false);
    }
  });
});

// ---------- 3. Cada tipo de decisão ----------

describe('aplicação de cada decisão', () => {
  it('KeepGroupingAsSingleArea: item único, issueId na proveniência', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const p = resolved(resolve(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }]));
    expect(p.items.length).toBe(1);
    expect(p.items[0].displayName).toBe('Nilson Veloso I e II');
    expect(p.items[0].provenance.sourceLineNumbers).toEqual([2]);
    expect(p.items[0].provenance.sourceIssueIds).toContain(idOf(ctx, 'AMBIGUOUS_GROUPING'));
  });

  it('SplitGroupingIntoAreas: 1 -> 2, herda preço e linha, ordem preservada', () => {
    const ctx = analyze('R$15,00\nNilson Veloso I e II');
    const d: PricingImportDecision = { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] };
    const p = resolved(resolve(ctx, [d]));
    expect(p.items.map((i) => i.displayName)).toEqual(['Nilson Veloso I', 'Nilson Veloso II']);
    expect(p.items.every((i) => (i.amountCents as number) === 1500)).toBe(true);
    expect(p.items.every((i) => i.provenance.sourceLineNumbers.length === 1 && i.provenance.sourceLineNumbers[0] === 2)).toBe(true);
    expect(p.items.every((i) => i.provenance.sourceIssueIds.includes(idOf(ctx, 'AMBIGUOUS_GROUPING')))).toBe(true);
    expect(p.items.every((i) => i.aliases.length === 0)).toBe(true);
  });

  it('KeepPossibleAliasLiteral: mantém literal, sem alias', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)');
    const p = resolved(resolve(ctx, [{ kind: 'KeepPossibleAliasLiteral', issueId: idOf(ctx, 'POSSIBLE_ALIAS') }]));
    expect(p.items.length).toBe(1);
    expect(p.items[0].aliases).toEqual([]);
    expect(p.items[0].displayName).toBe('Milhão (antiga Kowalski)');
    expect(p.items[0].provenance.sourceIssueIds).toContain(idOf(ctx, 'POSSIBLE_ALIAS'));
  });

  it('RegisterAlias: adiciona alias normalizado, não renomeia nem muda preço', () => {
    const ctx = analyze('R$10,00\nMilhão (antiga Kowalski)');
    const d: PricingImportDecision = { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS'), targetLineNumber: 2, alias: 'Kowalski Velho' };
    const p = resolved(resolve(ctx, [d]));
    expect(p.items[0].displayName).toBe('Milhão (antiga Kowalski)');
    expect(p.items[0].aliases).toEqual(['kowalski velho']);
    expect(p.items[0].amountCents as number).toBe(1000);
  });

  it('KeepConflictSeparate: mantém ambos, sem fusão nem alias', () => {
    const ctx = analyze('R$15,00\nMilhão (antiga Kowalski)\nR$20,00\nKowalski');
    const d: PricingImportDecision = { kind: 'KeepConflictSeparate', issueIds: [idOf(ctx, 'POSSIBLE_ALIAS'), idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')] };
    const p = resolved(resolve(ctx, [d]));
    const byName = new Map(p.items.map((i) => [i.nameNormalized, i]));
    expect(byName.get('milhao antiga kowalski')?.amountCents as number).toBe(1500);
    expect(byName.get('kowalski')?.amountCents as number).toBe(2000);
    expect(p.items.every((i) => i.aliases.length === 0)).toBe(true);
    expect(byName.get('milhao antiga kowalski')?.provenance.sourceIssueIds).toEqual(
      expect.arrayContaining([idOf(ctx, 'POSSIBLE_ALIAS'), idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')]),
    );
    expect(byName.get('kowalski')?.provenance.sourceIssueIds).toContain(idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE'));
  });

  it('ConsolidateDuplicate: sobrevivente contém todas as linhas', () => {
    const ctx = analyze('R$10,00\nCentro\nCentro');
    const p = resolved(resolve(ctx, [{ kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 3 }]));
    expect(p.items.length).toBe(1);
    expect(p.items[0].provenance.sourceLineNumbers).toEqual([2, 3]);
    expect(p.items[0].amountCents as number).toBe(1000);
  });

  it('ChooseDuplicateVariant: mantém preço escolhido, todas as linhas na proveniência', () => {
    const ctx = analyze('R$10,00\nCentro\nR$20,00\nCentro');
    const p = resolved(resolve(ctx, [{ kind: 'ChooseDuplicateVariant', issueId: idOf(ctx, 'DUPLICATE_WITH_DIFFERENT_PRICE'), keepLineNumber: 4 }]));
    expect(p.items.length).toBe(1);
    expect(p.items[0].amountCents as number).toBe(2000);
    expect(p.items[0].provenance.sourceLineNumbers).toEqual([2, 4]);
  });
});

// ---------- 4. Conflitos entre decisões ----------

describe('conflitos entre decisões', () => {
  function expectConflict(r: PricingProposalResolutionResult) {
    expect(r.ok).toBe(false);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('CONFLICTING_DECISIONS');
    else throw new Error('esperava CONFLICTING_DECISIONS, veio ' + JSON.stringify(r));
  }
  it('split + consolidação na mesma linha', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II\nNilson Veloso I e II');
    const r = resolve(ctx, [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 0), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 1), names: ['Nilson Veloso III', 'Nilson Veloso IV'] },
      { kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 2 },
    ]);
    expectConflict(r);
  });
  it('split + escolha de variante na mesma linha', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II\nR$20,00\nNilson Veloso I e II');
    const r = resolve(ctx, [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 0), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 1), names: ['Nilson Veloso III', 'Nilson Veloso IV'] },
      { kind: 'ChooseDuplicateVariant', issueId: idOf(ctx, 'DUPLICATE_WITH_DIFFERENT_PRICE'), keepLineNumber: 2 },
    ]);
    expectConflict(r);
  });
  it('alias apontando para linha dividida', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II (antiga X)');
    const r = resolve(ctx, [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
      { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS'), targetLineNumber: 2, alias: 'Xis Velho' },
    ]);
    expectConflict(r);
  });
  it('alias apontando para linha removida (consolidada)', () => {
    const ctx = analyze('R$10,00\nCentro (antiga X)\nCentro (antiga X)');
    const r = resolve(ctx, [
      { kind: 'ConsolidateDuplicate', issueId: idOf(ctx, 'DUPLICATE_IN_PASTE'), keepLineNumber: 2 },
      { kind: 'KeepPossibleAliasLiteral', issueId: idOf(ctx, 'POSSIBLE_ALIAS', 0) },
      { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS', 1), targetLineNumber: 3, alias: 'Xis Velho' },
    ]);
    expectConflict(r);
  });
});

// ---------- 5. Validação estrutural ----------

describe('validação estrutural da proposta', () => {
  it('duplicidade criada por split -> DUPLICATE_RESOLVED_NAME', () => {
    const ctx = analyze('R$10,00\nCentro\nNilson Veloso I e II');
    const r = resolve(ctx, [{ kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Centro', 'Outro Nome'] }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('DUPLICATE_RESOLVED_NAME');
    else throw new Error('esperava DUPLICATE_RESOLVED_NAME');
  });
  it('alias colidindo com nome de outra área (nome criado por split) -> RESOLVED_ALIAS_CONFLICT', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II\nCentro (antiga X)');
    const r = resolve(ctx, [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Kowalski Novo'] },
      { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS'), targetLineNumber: 3, alias: 'Kowalski Novo' },
    ]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('RESOLVED_ALIAS_CONFLICT');
    else throw new Error('esperava RESOLVED_ALIAS_CONFLICT');
  });
  it('alias colidindo com alias de outra área -> RESOLVED_ALIAS_CONFLICT', () => {
    const ctx = analyze('R$10,00\nAlpha (antiga X)\nBeta (antiga Y)');
    const r = resolve(ctx, [
      { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS', 0), targetLineNumber: 2, alias: 'Compartilhado' },
      { kind: 'RegisterAlias', issueId: idOf(ctx, 'POSSIBLE_ALIAS', 1), targetLineNumber: 3, alias: 'Compartilhado' },
    ]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('RESOLVED_ALIAS_CONFLICT');
    else throw new Error('esperava RESOLVED_ALIAS_CONFLICT');
  });
  it('limite de 300 áreas após split -> TOO_MANY_RESOLVED_AREAS', () => {
    const L: string[] = ['R$10,00'];
    for (let i = 1; i <= 299; i += 1) L.push('Bairro ' + i);
    L.push('Nilson Veloso I e II'); // 300 itens no parse
    const ctx = analyze(L.join('\n'));
    expect(ctx.parse.items.length).toBe(300);
    const r = resolve(ctx, [{ kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] }]);
    if (!r.ok && r.state === 'resolution_invalid') expect(r.code).toBe('TOO_MANY_RESOLVED_AREAS');
    else throw new Error('esperava TOO_MANY_RESOLVED_AREAS');
  });
  it('contabilidade: toda linha de item aparece na proveniência (nunca UNACCOUNTED)', () => {
    const ctx = analyze('R$10,00\nCentro\nR$20,00\nCentro\nBairro Novo');
    const p = resolved(resolve(ctx, [{ kind: 'ChooseDuplicateVariant', issueId: idOf(ctx, 'DUPLICATE_WITH_DIFFERENT_PRICE'), keepLineNumber: 2 }]));
    const covered = new Set<number>();
    for (const it of p.items) for (const l of it.provenance.sourceLineNumbers) covered.add(l);
    for (const it of ctx.parse.items) expect(covered.has(it.lineNumber)).toBe(true);
    // proveniência sempre válida: linhas existentes e não vazias
    for (const it of p.items) {
      expect(it.provenance.sourceLineNumbers.length).toBeGreaterThan(0);
      for (const l of it.provenance.sourceLineNumbers) expect(ctx.parse.items.some((x) => x.lineNumber === l)).toBe(true);
    }
  });
});

// ---------- 6. Ordem e determinismo ----------

describe('determinismo e imutabilidade', () => {
  it('decisões embaralhadas produzem proposta idêntica', () => {
    const ctx = analyze('R$15,00\nMilhão (antiga Kowalski)\nR$20,00\nKowalski\nNilson Veloso I e II');
    // observação: "Nilson Veloso I e II" está no grupo R$20 (2000) aqui
    const decisions: PricingImportDecision[] = [
      { kind: 'KeepConflictSeparate', issueIds: [idOf(ctx, 'POSSIBLE_ALIAS'), idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')] },
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
    ];
    const a = resolved(resolve(ctx, decisions));
    const b = resolved(resolve(ctx, [...decisions].reverse()));
    expect(a).toEqual(b);
  });
  it('não muta as arrays/objetos de decisão de entrada', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const decisions: PricingImportDecision[] = [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING'), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
    ];
    const snap = JSON.stringify(decisions);
    resolve(ctx, decisions);
    expect(JSON.stringify(decisions)).toBe(snap);
  });
});

// ---------- 7. Lista real (51 -> 53) ----------

describe('lista real (51 itens) -> proposta resolvida com 53', () => {
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
  it('dois splits + KeepConflictSeparate -> 53 itens, preços e proveniência corretos', () => {
    const ctx = analyze(buildList());
    expect(ctx.parse.items.length).toBe(51);
    const decisions: PricingImportDecision[] = [
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 0), names: ['Nilson Veloso I', 'Nilson Veloso II'] },
      { kind: 'SplitGroupingIntoAreas', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING', 1), names: ['Condomínio Flamboyant I', 'Condomínio Flamboyant II'] },
      { kind: 'KeepConflictSeparate', issueIds: [idOf(ctx, 'POSSIBLE_ALIAS'), idOf(ctx, 'ALIAS_CONFLICT_IN_PASTE')] },
    ];
    const p = resolved(resolve(ctx, decisions));

    expect(p.items.length).toBe(53);
    const byName = new Map(p.items.map((i) => [i.nameNormalized, i]));
    // quatro derivados dos splits, todos a 1500
    for (const n of ['nilson veloso i', 'nilson veloso ii', 'condominio flamboyant i', 'condominio flamboyant ii']) {
      expect(byName.get(n)?.amountCents as number).toBe(1500);
    }
    // Milhão 1500 e Kowalski 2000, separados; nenhum alias "kowalski"
    expect(byName.get('milhao antiga kowalski')?.amountCents as number).toBe(1500);
    expect(byName.get('kowalski')?.amountCents as number).toBe(2000);
    expect(p.items.every((i) => !i.aliases.includes('kowalski'))).toBe(true);
    expect(p.items.every((i) => i.aliases.length === 0)).toBe(true);

    // proveniência: nada de linhas perdidas; excludedLines vazio; 4 issues aplicadas
    expect(p.excludedLines).toEqual([]);
    expect(p.appliedIssueIds.length).toBe(4);
    const covered = new Set<number>();
    for (const it of p.items) for (const l of it.provenance.sourceLineNumbers) covered.add(l);
    for (const it of ctx.parse.items) expect(covered.has(it.lineNumber)).toBe(true);
  });
});

// ---------- 8. Segurança conceitual ----------

describe('segurança conceitual', () => {
  it('a proposta não expõe id, canPublish nem campos de publicação', () => {
    const ctx = analyze('R$10,00\nNilson Veloso I e II');
    const p = resolved(resolve(ctx, [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(ctx, 'AMBIGUOUS_GROUPING') }]));
    expect(Object.keys(p).sort()).toEqual(['analysisKey', 'appliedIssueIds', 'excludedLines', 'items']);
    for (const it of p.items) {
      expect(Object.keys(it).sort()).toEqual(['aliases', 'amountCents', 'displayName', 'nameNormalized', 'provenance']);
      expect('id' in it).toBe(false);
      expect('canPublish' in it).toBe(false);
    }
  });
  it('sempre reconstrói a partir do texto (adulterar o texto invalida por stale)', () => {
    const original = analyze('R$10,00\nNilson Veloso I e II');
    const decisions: PricingImportDecision[] = [{ kind: 'KeepGroupingAsSingleArea', issueId: idOf(original, 'AMBIGUOUS_GROUPING') }];
    const tampered = resolvePricingProposal({ rawText: 'R$99,00\nNilson Veloso I e II', expectedAnalysisKey: original.key, decisions });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok && tampered.state === 'resolution_invalid') expect(tampered.code).toBe('STALE_ANALYSIS_KEY');
  });
});
