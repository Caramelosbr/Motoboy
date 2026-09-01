import { describe, it, expect } from 'vitest';
import { toCents } from '../../../shared/currency';
import { matchPricingArea, createPricingArea, type PricingArea } from './index';

function area(id: string, displayName: string, aliases: string[] = []): PricingArea {
  const r = createPricingArea({ id, displayName, aliases, amountCents: toCents(1500) });
  if (!r.ok) throw new Error('fixture inválida: ' + r.code);
  return r.value;
}

const ceuAzul = area('a-ceu', 'Céu Azul');
const decio = area('a-decio', 'Décio 060');
const br153 = area('a-br', 'BR-153');
const milhao = area('a-milhao', 'Milhão (antiga Kowalski)'); // sem alias explícito
const milhaoComAlias = area('a-milhao2', 'Milhão', ['kowalski']);

describe('matchPricingArea — none / unique', () => {
  it('"Céu Azul" encontra "ceu azul" (por nome)', () => {
    const m = matchPricingArea([ceuAzul], ['CÉU  AZUL']);
    expect(m.kind).toBe('unique');
    if (m.kind === 'unique') { expect(m.area.id).toBe('a-ceu'); expect(m.by).toBe('name'); }
  });
  it('acento/caixa/espaço encontram a mesma área', () => {
    const m = matchPricingArea([ceuAzul], ['  ceu azul ']);
    expect(m.kind === 'unique' && m.area.id === 'a-ceu').toBe(true);
  });
  it('"Décio 060" mantém 060 como parte do nome e casa exato', () => {
    expect(matchPricingArea([decio], ['Décio 060']).kind).toBe('unique');
    expect(matchPricingArea([decio], ['Décio']).kind).toBe('none'); // substring não casa
  });
  it('"BR-153" mantém 153 e casa por "br 153"', () => {
    expect(matchPricingArea([br153], ['BR 153']).kind).toBe('unique');
  });
  it('área inexistente -> none', () => {
    expect(matchPricingArea([ceuAzul], ['Jardim Europa']).kind).toBe('none');
  });
  it('substring não é match', () => {
    expect(matchPricingArea([ceuAzul], ['ceu']).kind).toBe('none');
  });
  it('candidatos vazios / só pontuação -> none', () => {
    expect(matchPricingArea([ceuAzul], ['', '   ', '---']).kind).toBe('none');
  });
});

describe('matchPricingArea — aliases', () => {
  it('"Kowalski" NÃO encontra "Milhão (antiga Kowalski)" sem alias explícito', () => {
    expect(matchPricingArea([milhao], ['Kowalski']).kind).toBe('none');
  });
  it('com alias explícito "kowalski", encontra a área (por alias)', () => {
    const m = matchPricingArea([milhaoComAlias], ['Kowalski']);
    expect(m.kind).toBe('unique');
    if (m.kind === 'unique') { expect(m.area.id).toBe('a-milhao2'); expect(m.by).toBe('alias'); }
  });
  it('mesma área casada por nome e por alias -> unique com by="name"', () => {
    const m = matchPricingArea([milhaoComAlias], ['Milhão', 'kowalski']);
    expect(m.kind).toBe('unique');
    if (m.kind === 'unique') expect(m.by).toBe('name');
  });
});

describe('matchPricingArea — ambiguous', () => {
  it('"kowalski" é nome de uma área e alias de outra -> ambiguous', () => {
    const kowalskiArea = area('a-kow', 'Kowalski');           // nome = "kowalski"
    const outra = area('a-out', 'Milhão', ['kowalski']);       // alias = "kowalski"
    const m = matchPricingArea([kowalskiArea, outra], ['Kowalski']);
    expect(m.kind).toBe('ambiguous');
    if (m.kind === 'ambiguous') expect(m.areas.map((a) => a.id)).toEqual(['a-kow', 'a-out']); // ordenado por id
  });
  it('nome e alias apontando para áreas diferentes -> ambiguous', () => {
    const a1 = area('id-1', 'Central');
    const a2 = area('id-2', 'Centro', ['central']);
    const m = matchPricingArea([a2, a1], ['central']); // ordem de entrada trocada
    expect(m.kind).toBe('ambiguous');
    if (m.kind === 'ambiguous') expect(m.areas.map((a) => a.id)).toEqual(['id-1', 'id-2']);
  });
});

describe('matchPricingArea — district/suburb/locality e imutabilidade', () => {
  it('vários componentes apontando para a MESMA área -> unique', () => {
    const centro = area('a-centro', 'Setor Central', ['central']);
    const m = matchPricingArea([centro], ['Setor Central', 'central', 'setor central']);
    expect(m.kind).toBe('unique');
    if (m.kind === 'unique') expect(m.area.id).toBe('a-centro');
  });
  it('não muta arrays de entrada nem candidatos', () => {
    const areas = [ceuAzul, milhaoComAlias];
    const areasSnap = areas.map((a) => a.id);
    const candidates = ['ceu azul', 'kowalski'];
    const candSnap = [...candidates];
    matchPricingArea(areas, candidates);
    expect(areas.map((a) => a.id)).toEqual(areasSnap);
    expect(candidates).toEqual(candSnap);
    // entidades permanecem intactas
    expect(ceuAzul.aliases).toEqual([]);
  });
});
