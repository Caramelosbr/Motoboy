import { describe, it, expect } from 'vitest';
import {
  parsePricingTablePaste,
  MAX_PRICING_IMPORT_TEXT_LENGTH,
  MAX_PRICING_IMPORT_LINES,
} from './index';

function ok(raw: string) {
  const r = parsePricingTablePaste(raw);
  if (!r.ok) throw new Error('esperava ok, veio fatal ' + r.fatal.code);
  return r;
}
function codes(r: ReturnType<typeof ok>): string[] {
  return r.issues.map((i) => i.code);
}

describe('limites e fatais', () => {
  it('constantes', () => {
    expect(MAX_PRICING_IMPORT_TEXT_LENGTH).toBe(50_000);
    expect(MAX_PRICING_IMPORT_LINES).toBe(1_000);
  });
  it('EMPTY_INPUT', () => {
    const r = parsePricingTablePaste('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fatal.code).toBe('EMPTY_INPUT');
  });
  it('TEXT_TOO_LONG', () => {
    const r = parsePricingTablePaste('R$1,00\n' + 'a'.repeat(MAX_PRICING_IMPORT_TEXT_LENGTH));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fatal.code).toBe('TEXT_TOO_LONG');
  });
  it('TOO_MANY_LINES', () => {
    const r = parsePricingTablePaste(Array.from({ length: MAX_PRICING_IMPORT_LINES + 1 }, () => 'x').join('\n'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fatal.code).toBe('TOO_MANY_LINES');
  });
});

describe('cabeçalhos de preço', () => {
  it('reconhece R$12,00 / R$ 15,00 / R$20 / 25,00 / 12,50 / emoji', () => {
    const r = ok('🟩 R$12,00\nfoo\nR$ 15,00\nbar\nR$20\nbaz\n25,00\nqux\n12,50\nquux');
    expect(r.groups.map((g) => g.amountCents as number)).toEqual([1200, 1500, 2000, 2500, 1250]);
  });
  it('inteiro isolado sem R$ -> AMBIGUOUS_PRICE_HEADER (nunca preço)', () => {
    const r = ok('20\n060\n1.234');
    expect(codes(r).filter((c) => c === 'AMBIGUOUS_PRICE_HEADER').length).toBe(3);
    expect(r.groups.length).toBe(0);
  });
  it('R$0,00 -> INVALID_PRICE', () => {
    const r = ok('R$0,00\nfoo');
    expect(codes(r)).toContain('INVALID_PRICE');
  });
});

describe('linhas de área e bullets', () => {
  it('remove marcadores iniciais preservando o nome', () => {
    const r = ok('R$10,00\n• Céu Azul\n* santa clara\n- Décio 060\n– BR-153');
    expect(r.items.map((i) => i.displayName)).toEqual(['Céu Azul', 'santa clara', 'Décio 060', 'BR-153']);
    expect(r.items.every((i) => (i.amountCents as number) === 1000)).toBe(true);
  });
  it('números fazem parte do nome (não viram preço)', () => {
    const r = ok('R$10,00\nDécio 060\nBR-153\nKowalski 20\nNilson Veloso XpTo');
    const nomes = r.items.map((i) => i.displayName);
    expect(nomes).toContain('Décio 060');
    expect(nomes).toContain('BR-153');
    expect(nomes).toContain('Kowalski 20');
    expect(r.items.find((i) => i.displayName === 'Kowalski 20')?.amountCents as number).toBe(1000);
  });
});

describe('preço inline', () => {
  it('reconhece R$ com/sem separador e travessão + decimal', () => {
    const r = ok('R$10,00\nKowalski — R$ 20,00\nAlfa: R$20\nBeta | R$ 20,00\nGama — 20,00\nDelta R$20');
    const byName = Object.fromEntries(r.items.map((i) => [i.displayName, i]));
    expect(byName['Kowalski'].amountCents as number).toBe(2000);
    expect(byName['Kowalski'].priceSource).toBe('inline');
    expect(byName['Alfa'].amountCents as number).toBe(2000);
    expect(byName['Beta'].amountCents as number).toBe(2000);
    expect(byName['Gama'].amountCents as number).toBe(2000);
    expect(byName['Delta'].amountCents as number).toBe(2000);
  });
  it('inteiro final sem R$ continua nome (Kowalski 20 / Décio 060)', () => {
    const r = ok('R$10,00\nKowalski 20\nDécio 060');
    expect(r.items.map((i) => i.displayName)).toEqual(['Kowalski 20', 'Décio 060']);
    expect(r.items.every((i) => (i.amountCents as number) === 1000)).toBe(true);
  });
  it('inline não altera o preço do grupo ativo', () => {
    const r = ok('R$10,00\nKowalski — R$ 20,00\nOutro');
    const outro = r.items.find((i) => i.displayName === 'Outro');
    expect(outro?.amountCents as number).toBe(1000); // segue o grupo, não o inline anterior
  });
});

describe('separadores e números de linha', () => {
  it('ignora vazias/---/===/⸻ e NÃO trata BR-153 como separador', () => {
    const r = ok('R$10,00\n---\n===\n⸻\n\nBR-153');
    expect(r.items.map((i) => i.displayName)).toEqual(['BR-153']);
    expect(r.items[0].lineNumber).toBe(6); // numeração preserva as linhas ignoradas
  });
  it('NO_ACTIVE_PRICE quando não há grupo ativo', () => {
    const r = ok('Céu Azul');
    expect(codes(r)).toContain('NO_ACTIVE_PRICE');
    expect(r.items[0].amountCents).toBeNull();
    expect(r.canPublish).toBe(false);
  });
});

describe('agrupamento ambíguo × conjunção "e"', () => {
  it('marca I e II / 1 e 2 / Bloco A e B', () => {
    const r = ok('R$10,00\nNilson Veloso I e II\nQuadra 1 e 2\nBloco A e B\nCondomínio Flamboyant I e II');
    expect(codes(r).filter((c) => c === 'AMBIGUOUS_GROUPING').length).toBe(4);
  });
  it('NÃO marca nomes comuns com "e"', () => {
    const r = ok('R$10,00\nParque Verde e Vida\nJardim Saúde e Paz');
    expect(codes(r)).not.toContain('AMBIGUOUS_GROUPING');
  });
});

describe('aliases e conflito', () => {
  it('POSSIBLE_ALIAS + ALIAS_CONFLICT_IN_PASTE (Milhão/Kowalski)', () => {
    const r = ok('R$15,00\nMilhão (antiga Kowalski)\nR$20,00\nKowalski');
    expect(codes(r)).toContain('POSSIBLE_ALIAS');
    expect(codes(r)).toContain('ALIAS_CONFLICT_IN_PASTE');
    // não une: os dois itens continuam presentes
    const nomes = r.items.map((i) => i.nameNormalized);
    expect(nomes).toContain('milhao antiga kowalski');
    expect(nomes).toContain('kowalski');
    expect(r.canPublish).toBe(false);
  });
  it('POSSIBLE_ALIAS sem item independente -> não vira conflito', () => {
    const r = ok('R$15,00\nMilhão (antiga Kowalski)');
    expect(codes(r)).toContain('POSSIBLE_ALIAS');
    expect(codes(r)).not.toContain('ALIAS_CONFLICT_IN_PASTE');
  });
});

describe('duplicidades', () => {
  it('DUPLICATE_IN_PASTE (mesmo preço)', () => {
    const r = ok('R$10,00\nCentro\nCentro');
    expect(codes(r)).toContain('DUPLICATE_IN_PASTE');
  });
  it('DUPLICATE_WITH_DIFFERENT_PRICE', () => {
    const r = ok('R$10,00\nCentro\nR$20,00\nCentro');
    expect(codes(r)).toContain('DUPLICATE_WITH_DIFFERENT_PRICE');
  });
  it('substring NÃO é duplicidade', () => {
    const r = ok('R$10,00\nComigo\nComigo Implementos\nVerde Vida\nParque Verde Vida');
    expect(codes(r)).not.toContain('DUPLICATE_IN_PASTE');
    expect(codes(r)).not.toContain('DUPLICATE_WITH_DIFFERENT_PRICE');
  });
});

describe('lista real (51 itens em 4 grupos)', () => {
  function buildList(): string {
    const L: string[] = [];
    L.push('R$12,00:');
    L.push('• Condomínio Flamboyant I e II');
    for (let i = 1; i <= 16; i += 1) L.push('• Setor Doze ' + String(i).padStart(2, '0'));
    L.push('');
    L.push('R$15,00:');
    L.push('• Milhão (antiga Kowalski)');
    for (let i = 1; i <= 10; i += 1) L.push('* Setor Quinze ' + String(i).padStart(2, '0'));
    L.push('⸻');
    L.push('R$20,00:');
    L.push('* santa clara');
    L.push('- Kowalski');
    L.push('• Nilson Veloso I e II');
    for (let i = 1; i <= 17; i += 1) L.push('- Setor Vinte ' + String(i).padStart(2, '0'));
    L.push('---');
    L.push('R$25,00:');
    L.push('• Décio 060');
    L.push('• Zona 2501');
    L.push('• Zona 2502');
    return L.join('\n');
  }

  it('reconhece 51 itens, 4 grupos e bloqueia publicação', () => {
    const r = ok(buildList());
    expect(r.items.length).toBe(51);
    expect(r.groups.map((g) => g.amountCents as number)).toEqual([1200, 1500, 2000, 2500]);
    expect(r.unparsed.length).toBe(0);

    const byName = new Map(r.items.map((i) => [i.nameNormalized, i]));
    expect(byName.get('decio 060')?.displayName).toBe('Décio 060');
    expect(byName.get('decio 060')?.amountCents as number).toBe(2500);
    expect(byName.get('santa clara')?.amountCents as number).toBe(2000);
    expect(byName.get('kowalski')?.amountCents as number).toBe(2000);
    expect(byName.get('milhao antiga kowalski')?.amountCents as number).toBe(1500);

    const cs = codes(r);
    expect(cs.filter((c) => c === 'AMBIGUOUS_GROUPING').length).toBe(2); // Flamboyant + Nilson
    expect(cs).toContain('POSSIBLE_ALIAS');
    expect(cs).toContain('ALIAS_CONFLICT_IN_PASTE');
    expect(cs).not.toContain('DUPLICATE_IN_PASTE');
    expect(r.canPublish).toBe(false);
  });
});
