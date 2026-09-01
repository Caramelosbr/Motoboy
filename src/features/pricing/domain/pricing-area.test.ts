import { describe, it, expect } from 'vitest';
import { toCents, type Cents } from '../../../shared/currency';
import {
  createPricingArea,
  validatePricingArea,
  MAX_PRICING_AREAS,
  MAX_PRICING_AREA_ID_LENGTH,
  MAX_PRICING_DISPLAY_NAME_LENGTH,
  MAX_PRICING_ALIASES,
  MAX_PRICING_ALIAS_LENGTH,
  type NewPricingArea,
  type PricingArea,
} from './index';

function novo(over: Partial<NewPricingArea> = {}): NewPricingArea {
  return { id: 'area-1', displayName: 'Céu Azul', amountCents: toCents(1500), ...over };
}

describe('limites do domínio', () => {
  it('valores oficiais', () => {
    expect(MAX_PRICING_AREAS).toBe(300);
    expect(MAX_PRICING_AREA_ID_LENGTH).toBe(128);
    expect(MAX_PRICING_DISPLAY_NAME_LENGTH).toBe(120);
    expect(MAX_PRICING_ALIASES).toBe(10);
    expect(MAX_PRICING_ALIAS_LENGTH).toBe(120);
  });
});

describe('createPricingArea — sucesso', () => {
  it('cria com nameNormalized calculado internamente', () => {
    const r = createPricingArea(novo());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.nameNormalized).toBe('ceu azul');
      expect(r.value.displayName).toBe('Céu Azul');
      expect(r.value.aliases).toEqual([]);
      expect(r.value.amountCents as number).toBe(1500);
    }
  });
  it('aceita e normaliza aliases explícitos', () => {
    const r = createPricingArea(novo({ displayName: 'Milhão', aliases: ['Antiga Kowalski', 'MILHAO VELHO'] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.aliases).toEqual(['antiga kowalski', 'milhao velho']);
  });
  it('aceita type válido e omite quando ausente', () => {
    const r = createPricingArea(novo({ type: 'condominio' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('condominio');
    const semTipo = createPricingArea(novo());
    if (semTipo.ok) expect('type' in semTipo.value).toBe(false);
  });
  it('não muta o input (aliases copiados)', () => {
    const aliases = ['apelido'];
    const input = novo({ aliases });
    createPricingArea(input);
    expect(aliases).toEqual(['apelido']); // original intacto
  });
});

describe('createPricingArea — validação de id', () => {
  it('id vazio', () => {
    const r = createPricingArea(novo({ id: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_ID');
  });
  it('id acima de 128', () => {
    const r = createPricingArea(novo({ id: 'a'.repeat(129) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ID_TOO_LONG');
  });
  it('id com barra', () => {
    const r = createPricingArea(novo({ id: 'a/b' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_ID');
  });
  it('id "." e ".."', () => {
    expect(createPricingArea(novo({ id: '.' })).ok).toBe(false);
    expect(createPricingArea(novo({ id: '..' })).ok).toBe(false);
  });
  it('id reservado __...__', () => {
    const r = createPricingArea(novo({ id: '__proto__' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_ID');
  });
  it('aceita exatamente 128', () => {
    expect(createPricingArea(novo({ id: 'a'.repeat(128) })).ok).toBe(true);
  });
});

describe('createPricingArea — displayName / normalizado', () => {
  it('displayName vazio', () => {
    const r = createPricingArea(novo({ displayName: '   ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_DISPLAY_NAME');
  });
  it('displayName longo demais', () => {
    const r = createPricingArea(novo({ displayName: 'x'.repeat(MAX_PRICING_DISPLAY_NAME_LENGTH + 1) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DISPLAY_NAME_TOO_LONG');
  });
  it('displayName só com pontuação -> INVALID_NORMALIZED_NAME', () => {
    const r = createPricingArea(novo({ displayName: '---' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_NORMALIZED_NAME');
  });
});

describe('createPricingArea — amountCents', () => {
  const invalidos: ReadonlyArray<readonly [string, number]> = [
    ['zero', 0],
    ['negativo', -100],
    ['float', 15.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['overflow', Number.MAX_SAFE_INTEGER + 1],
  ];
  for (const [nome, valor] of invalidos) {
    it(`rejeita ${nome}`, () => {
      const r = createPricingArea(novo({ amountCents: valor as Cents }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
    });
  }
});

describe('createPricingArea — type e aliases', () => {
  it('type inválido', () => {
    const r = createPricingArea(novo({ type: 'zona' as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TYPE');
  });
  it('aliases demais', () => {
    const aliases = Array.from({ length: MAX_PRICING_ALIASES + 1 }, (_v, i) => 'alias ' + i);
    const r = createPricingArea(novo({ aliases }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TOO_MANY_ALIASES');
  });
  it('alias vazio', () => {
    const r = createPricingArea(novo({ aliases: ['  '] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_ALIAS');
  });
  it('alias longo demais', () => {
    const r = createPricingArea(novo({ aliases: ['a'.repeat(MAX_PRICING_ALIAS_LENGTH + 1)] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ALIAS_TOO_LONG');
  });
  it('alias igual ao nome principal (após normalização)', () => {
    const r = createPricingArea(novo({ displayName: 'Céu Azul', aliases: ['CÉU AZUL'] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ALIAS_EQUALS_NAME');
  });
  it('aliases duplicados por acento/caixa', () => {
    const r = createPricingArea(novo({ aliases: ['Kowalski', 'kowálski'] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_ALIAS');
  });
});

describe('validatePricingArea', () => {
  const base: PricingArea = {
    id: 'area-1',
    displayName: 'Céu Azul',
    nameNormalized: 'ceu azul',
    aliases: [],
    amountCents: toCents(1500),
  };
  it('entidade coerente é válida', () => {
    expect(validatePricingArea(base).ok).toBe(true);
  });
  it('nameNormalized incoerente com displayName', () => {
    const r = validatePricingArea({ ...base, nameNormalized: 'outro' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_NORMALIZED_NAME');
  });
  it('amountCents inválido', () => {
    const r = validatePricingArea({ ...base, amountCents: 0 as Cents });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
  it('mesmo id em "versões" diferentes com outro valor é válido (sem novo id)', () => {
    const v1: PricingArea = { ...base, amountCents: toCents(1500) };
    const v2: PricingArea = { ...base, amountCents: toCents(2000) };
    expect(validatePricingArea(v1).ok).toBe(true);
    expect(validatePricingArea(v2).ok).toBe(true);
    expect(v1.id).toBe(v2.id); // identidade estável
  });
});

describe('validatePricingArea — aliases persistidos (fronteira de persistência)', () => {
  // Entidade construída MANUALMENTE (como o mapper Firestore faria), nome "Milhão".
  function manual(aliases: readonly string[], displayName = 'Milhão', nameNormalized = 'milhao'): PricingArea {
    return { id: 'area-1', displayName, nameNormalized, aliases, amountCents: toCents(1500) };
  }

  it('1) alias "Céu Azul" -> INVALID_NORMALIZED_ALIAS', () => {
    const r = validatePricingArea(manual(['Céu Azul']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_NORMALIZED_ALIAS');
  });
  it('2) alias "  ceu   azul  " -> INVALID_NORMALIZED_ALIAS', () => {
    const r = validatePricingArea(manual(['  ceu   azul  ']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_NORMALIZED_ALIAS');
  });
  it('3) alias "CEU AZUL" -> INVALID_NORMALIZED_ALIAS', () => {
    const r = validatePricingArea(manual(['CEU AZUL']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_NORMALIZED_ALIAS');
  });
  it('4) alias "ceu-azul" -> INVALID_NORMALIZED_ALIAS', () => {
    const r = validatePricingArea(manual(['ceu-azul']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_NORMALIZED_ALIAS');
  });
  it('5) alias canônico "ceu azul" (diferente do nome) -> aceita', () => {
    expect(validatePricingArea(manual(['ceu azul'])).ok).toBe(true);
  });
  it('6) alias que normaliza para vazio -> rejeitado', () => {
    expect(validatePricingArea(manual(['---'])).ok).toBe(false);
  });
  it('7) dois aliases canônicos iguais -> DUPLICATE_ALIAS', () => {
    const r = validatePricingArea(manual(['ceu azul', 'ceu azul']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_ALIAS');
  });
  it('8) alias canônico igual ao nameNormalized -> ALIAS_EQUALS_NAME', () => {
    const r = validatePricingArea(manual(['ceu azul'], 'Céu Azul', 'ceu azul'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ALIAS_EQUALS_NAME');
  });
  it('9) não modifica objeto/array nem substitui o alias pelo normalizado', () => {
    const aliases = ['Céu Azul'];
    const area = manual(aliases);
    const snapshot = JSON.stringify(area);
    validatePricingArea(area);
    expect(JSON.stringify(area)).toBe(snapshot); // objeto intacto
    expect(area.aliases).toBe(aliases);          // mesma referência
    expect(aliases[0]).toBe('Céu Azul');         // alias NÃO foi normalizado
  });
});

describe('createPricingArea — alias armazenado canônico', () => {
  it('10) "Céu Azul" é armazenado como "ceu azul"', () => {
    const r = createPricingArea({ id: 'a-1', displayName: 'Milhão', aliases: ['Céu Azul'], amountCents: toCents(1500) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.aliases).toEqual(['ceu azul']);
  });
});
