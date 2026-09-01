import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../shared/currency';
import {
  diffPricingTable,
  parsePricingTablePaste,
  createPricingArea,
  normalizePricingName,
  type PricingArea,
  type ParsedPricingItem,
  type PricingPasteParseResult,
} from './index';

function area(id: string, displayName: string, cents: number, aliases: string[] = []): PricingArea {
  const r = createPricingArea({ id, displayName, aliases, amountCents: toCents(cents) });
  if (!r.ok) throw new Error('fixture inválida: ' + r.code);
  return r.value;
}
function parse(text: string): PricingPasteParseResult {
  return parsePricingTablePaste(text);
}
function pi(displayName: string, cents: number | null, line = 1): ParsedPricingItem {
  return {
    lineNumber: line,
    rawLine: displayName,
    displayName,
    nameNormalized: normalizePricingName(displayName),
    amountCents: (cents === null ? null : toCents(cents)) as Cents | null,
    priceSource: 'group',
    groupIndex: 0,
  };
}
// Resultado de parser FORJADO — usado só para testar a defesa de fronteira do diff.
function forgedProposal(over: Partial<Extract<PricingPasteParseResult, { ok: true }>>): PricingPasteParseResult {
  return { ok: true, items: [], groups: [], issues: [], unparsed: [], canPublish: true, ...over };
}

describe('diff bloqueia parses não-limpos', () => {
  it('1) parse fatal ("") -> INVALID_PROPOSAL com fatalCode', () => {
    const r = diffPricingTable([], parse(''));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('INVALID_PROPOSAL');
      expect(r.fatalCode).toBe('EMPTY_INPUT');
    }
  });

  it('2) AMBIGUOUS_GROUPING (Nilson Veloso I e II) -> PROPOSAL_HAS_BLOCKING_ISSUES', () => {
    const r = diffPricingTable([], parse('R$10,00\nNilson Veloso I e II'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
      expect(r.issues?.map((i) => i.code)).toContain('AMBIGUOUS_GROUPING');
    }
  });

  it('3) alias/conflict (Milhão/Kowalski) -> bloqueado', () => {
    const r = diffPricingTable([], parse('R$15,00\nMilhão (antiga Kowalski)\nR$20,00\nKowalski'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
      expect(r.issues?.map((i) => i.code)).toContain('ALIAS_CONFLICT_IN_PASTE');
    }
  });

  it('4) linha não interpretada (forjado) -> bloqueado, preserva lineNumber', () => {
    const proposal = forgedProposal({ unparsed: [{ lineNumber: 3, rawLine: '???' }], canPublish: false });
    const r = diffPricingTable([], proposal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
      expect(r.unparsed?.[0].lineNumber).toBe(3);
    }
  });

  it('5) lista real de 51 itens -> parser canPublish false; diff rejeita antes das categorias', () => {
    const L: string[] = ['R$12,00:', '• Condomínio Flamboyant I e II'];
    for (let i = 1; i <= 16; i += 1) L.push('• Setor Doze ' + String(i).padStart(2, '0'));
    L.push('R$15,00:', '• Milhão (antiga Kowalski)');
    for (let i = 1; i <= 10; i += 1) L.push('* Setor Quinze ' + String(i).padStart(2, '0'));
    L.push('R$20,00:', '* santa clara', '- Kowalski', '• Nilson Veloso I e II');
    for (let i = 1; i <= 17; i += 1) L.push('- Setor Vinte ' + String(i).padStart(2, '0'));
    L.push('R$25,00:', '• Décio 060', '• Zona 2501', '• Zona 2502');
    const parsed = parse(L.join('\n'));
    expect(parsed.ok && parsed.items.length === 51 && parsed.canPublish === false).toBe(true);
    const r = diffPricingTable([], parsed);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
      expect('newItems' in (r as object)).toBe(false); // sem diff parcial
    }
  });

  it('6) proposta com duplicate -> bloqueada', () => {
    const r = diffPricingTable([], parse('R$10,00\nCentro\nCentro'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
      expect(r.issues?.map((i) => i.code)).toContain('DUPLICATE_IN_PASTE');
    }
  });

  it('7) proposta com preço ausente (sem grupo) -> bloqueada', () => {
    const r = diffPricingTable([], parse('Centro'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
      expect(r.issues?.map((i) => i.code)).toContain('NO_ACTIVE_PRICE');
    }
  });
});

describe('diff aceita apenas parse limpo', () => {
  it('8) proposta limpa -> diff funciona', () => {
    const r = diffPricingTable([], parse('R$10,00\nCentro\nNorte'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.counts.new).toBe(2);
  });

  it('9) categorias new/changed/removed/unchanged corretas', () => {
    const current = [area('a1', 'Centro', 1000), area('a2', 'Sul', 1000), area('a3', 'Leste', 1000)];
    const proposal = parse('R$10,00\nCentro\nNorte\nR$15,00\nLeste');
    const r = diffPricingTable(current, proposal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unchanged.map((u) => u.areaId)).toEqual(['a1']); // Centro
      expect(r.changed.map((c) => c.areaId)).toEqual(['a3']); // Leste 1000->1500
      expect(r.newItems.map((n) => n.proposed.nameNormalized)).toEqual(['norte']);
      expect(r.removed.map((x) => x.area.id)).toEqual(['a2']); // Sul
      expect(r.canPublish).toBe(true);
    }
  });

  it('10) parse limpo mas ambíguo contra a tabela -> conflicts, canPublish false', () => {
    const current = [area('a-kow', 'Kowalski', 2000), area('a-mil', 'Milhão', 1500, ['kowalski'])];
    const proposal = parse('R$20,00\nKowalski');
    expect(proposal.ok && proposal.canPublish).toBe(true); // parse é limpo
    const r = diffPricingTable(current, proposal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.conflicts).toHaveLength(1);
      expect(r.conflicts[0].candidates.map((c) => c.id)).toEqual(['a-kow', 'a-mil']);
      expect(r.canPublish).toBe(false);
    }
  });

  it('match por alias reaproveita id e não renomeia', () => {
    const current = [area('a1', 'Milhão', 1500, ['kowalski'])];
    const r = diffPricingTable(current, parse('R$15,00\nKowalski'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unchanged[0].areaId).toBe('a1');
      expect(r.unchanged[0].matchedBy).toBe('alias');
      expect(r.unchanged[0].current.displayName).toBe('Milhão');
    }
  });

  it('substring não casa', () => {
    const r = diffPricingTable([area('a1', 'Comigo', 1000)], parse('R$10,00\nComigo Implementos'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newItems).toHaveLength(1);
      expect(r.removed).toHaveLength(1);
    }
  });

  it('itens new não recebem id inventado', () => {
    const r = diffPricingTable([], parse('R$10,00\nNovo Bairro'));
    expect(r.ok).toBe(true);
    if (r.ok) expect('id' in (r.newItems[0].proposed as object)).toBe(false);
  });
});

describe('defesa de fronteira com objetos forjados', () => {
  it('11) forjado canPublish=true com issues -> bloqueado', () => {
    const proposal = forgedProposal({
      items: [pi('Centro', 1000)],
      issues: [{ code: 'AMBIGUOUS_GROUPING', lineNumber: 1, message: 'x' }],
      canPublish: true,
    });
    const r = diffPricingTable([], proposal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
  });

  it('12) forjado canPublish=false com issues vazias -> bloqueado', () => {
    const proposal = forgedProposal({ items: [pi('Centro', 1000)], canPublish: false });
    const r = diffPricingTable([], proposal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PROPOSAL_HAS_BLOCKING_ISSUES');
  });

  it('defensivo: forjado limpo com duplicado -> PROPOSAL_HAS_DUPLICATES', () => {
    const proposal = forgedProposal({ items: [pi('Centro', 1000, 1), pi('centro', 1200, 2)] });
    const r = diffPricingTable([], proposal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PROPOSAL_HAS_DUPLICATES');
  });

  it('defensivo: forjado limpo com item sem preço -> PROPOSAL_ITEM_WITHOUT_PRICE', () => {
    const proposal = forgedProposal({ items: [pi('Centro', null)] });
    const r = diffPricingTable([], proposal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PROPOSAL_ITEM_WITHOUT_PRICE');
  });

  it('tabela atual inválida -> INVALID_CURRENT_TABLE', () => {
    const bad = { id: 'a1', displayName: 'X', nameNormalized: 'outro', aliases: [], amountCents: toCents(1000) } as PricingArea;
    const r = diffPricingTable([bad], parse('R$10,00\nCentro'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CURRENT_TABLE');
  });
});

describe('imutabilidade e ausência de diff parcial', () => {
  it('13) não muta inputs', () => {
    const current = [area('a1', 'Centro', 1000)];
    const proposal = parse('R$15,00\nCentro\nNorte');
    const curSnap = JSON.stringify(current);
    const propSnap = JSON.stringify(proposal);
    diffPricingTable(current, proposal);
    expect(JSON.stringify(current)).toBe(curSnap);
    expect(JSON.stringify(proposal)).toBe(propSnap);
  });

  it('14) erro nunca traz categorias (sem diff parcial)', () => {
    const r = diffPricingTable([], parse('R$10,00\nCentro\nCentro'));
    expect(r.ok).toBe(false);
    expect('newItems' in (r as object)).toBe(false);
    expect('counts' in (r as object)).toBe(false);
  });
});
