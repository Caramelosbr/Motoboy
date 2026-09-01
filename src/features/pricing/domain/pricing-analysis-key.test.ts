import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../shared/currency';
import { parsePricingTablePaste, buildPricingAnalysisKey, type PricingPasteParseResult } from './index';

type CleanParse = Extract<PricingPasteParseResult, { ok: true }>;
function cleanParse(over: Partial<CleanParse> = {}): CleanParse {
  return { ok: true, items: [], groups: [], issues: [], unparsed: [], canPublish: true, ...over };
}
function keyOf(text: string): string {
  const parse = parsePricingTablePaste(text);
  const r = buildPricingAnalysisKey(text, parse);
  if (!r.ok) throw new Error('esperava key, veio ' + r.code);
  return r.key;
}

describe('buildPricingAnalysisKey — determinismo e sensibilidade', () => {
  it('mesma entrada -> mesma chave', () => {
    expect(keyOf('R$10,00\nCentro')).toBe(keyOf('R$10,00\nCentro'));
  });
  it('muda com espaço/quebra/pontuação no rawText', () => {
    expect(keyOf('R$10,00\nCentro')).not.toBe(keyOf('R$10,00\nCentro ')); // espaço final
    expect(keyOf('R$10,00\nCentro')).not.toBe(keyOf('R$10,00\n Centro')); // espaço inicial
    expect(keyOf('R$10,00\nCentro')).not.toBe(keyOf('R$10,00\nCentro.')); // pontuação
  });
  it('muda com alteração em item', () => {
    expect(keyOf('R$10,00\nCentro')).not.toBe(keyOf('R$10,00\nCentro Norte'));
  });
  it('muda com alteração em grupo (preço do cabeçalho)', () => {
    expect(keyOf('R$10,00\nCentro')).not.toBe(keyOf('R$20,00\nCentro'));
  });
  it('muda com alteração em issue', () => {
    expect(keyOf('R$10,00\nCentro')).not.toBe(keyOf('R$10,00\nNilson Veloso I e II'));
  });
  it('muda com alteração em unparsed (parses forjados, mesmo rawText)', () => {
    const a = buildPricingAnalysisKey('x', cleanParse({ unparsed: [] }));
    const b = buildPricingAnalysisKey('x', cleanParse({ unparsed: [{ lineNumber: 1, rawLine: '???' }] }));
    expect(a.ok && b.ok && a.key !== b.key).toBe(true);
  });
  it('null não colide com "" nem com ausência (detail)', () => {
    const nul = buildPricingAnalysisKey('x', cleanParse({ issues: [{ code: 'POSSIBLE_ALIAS', lineNumber: 1, message: 'm' }] }));
    const vazio = buildPricingAnalysisKey('x', cleanParse({ issues: [{ code: 'POSSIBLE_ALIAS', lineNumber: 1, message: 'm', detail: '' }] }));
    expect(nul.ok && vazio.ok && nul.key !== vazio.key).toBe(true);
  });
  it('parse fatal é rejeitado', () => {
    const r = buildPricingAnalysisKey('', parsePricingTablePaste(''));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FATAL_PARSE');
  });
  it('não muta as entradas', () => {
    const parse = cleanParse({
      items: [{ lineNumber: 2, rawLine: 'Centro', displayName: 'Centro', nameNormalized: 'centro', amountCents: toCents(1000) as Cents, priceSource: 'group', groupIndex: 0 }],
      issues: [{ code: 'DUPLICATE_IN_PASTE', lineNumber: 2, lineNumbers: [2, 3], message: 'm', detail: 'centro' }],
    });
    const snap = JSON.stringify(parse);
    buildPricingAnalysisKey('R$10,00\nCentro', parse);
    expect(JSON.stringify(parse)).toBe(snap);
  });
  it('é serialização completa (não hash): contém o rawText', () => {
    const key = keyOf('R$10,00\nBairro Xyz');
    expect(key.includes('Bairro Xyz')).toBe(true);
    expect(key.length).toBeGreaterThan('R$10,00\nBairro Xyz'.length);
  });
});
