import { describe, it, expect } from 'vitest';
import {
  toCents,
  addCents,
  subtractCents,
  parseBRLToCents,
  formatCentsBRL,
  type Cents,
} from './index';

describe('toCents', () => {
  it('cria valor válido', () => {
    expect(toCents(610)).toBe(610);
  });
  it('aceita zero', () => {
    expect(toCents(0)).toBe(0);
  });
  it('aceita um centavo', () => {
    expect(toCents(1)).toBe(1);
  });
  it('rejeita float', () => {
    expect(() => toCents(6.1)).toThrow(RangeError);
  });
  it('rejeita negativo', () => {
    expect(() => toCents(-1)).toThrow(RangeError);
  });
  it('rejeita NaN', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
  });
  it('rejeita Infinity', () => {
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
  it('rejeita acima de MAX_SAFE_INTEGER (overflow)', () => {
    expect(() => toCents(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('addCents', () => {
  it('soma válida', () => {
    expect(addCents(toCents(600), toCents(10))).toBe(610);
  });
  it('overflow na soma é rejeitado', () => {
    const big = toCents(Number.MAX_SAFE_INTEGER);
    expect(() => addCents(big, toCents(1))).toThrow(RangeError);
  });
});

describe('subtractCents', () => {
  it('subtração válida', () => {
    expect(subtractCents(toCents(610), toCents(10))).toBe(600);
  });
  it('subtração negativa é rejeitada', () => {
    expect(() => subtractCents(toCents(10), toCents(20))).toThrow(RangeError);
  });
});

describe('parseBRLToCents — exemplos aceitos', () => {
  const casos: ReadonlyArray<readonly [string, number]> = [
    ['0', 0],
    ['6', 600],
    ['6,1', 610],
    ['6,10', 610],
    ['0,01', 1],
    ['1234,56', 123456],
    ['1.234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['  R$ 1.234,56  ', 123456],
  ];
  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" -> ${esperado}`, () => {
      const r = parseBRLToCents(entrada);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value as number).toBe(esperado);
    });
  }
});

describe('parseBRLToCents — rejeições', () => {
  const invalidos: ReadonlyArray<readonly [string, string]> = [
    ['', 'vazio'],
    ['-5', 'negativo'],
    ['abc', 'letras'],
    ['1,5e3', 'notação científica'],
    ['1,234', 'três casas decimais'],
    ['1,2345', 'quatro casas decimais'],
    ['1.23', 'agrupamento inválido (2 dígitos)'],
    ['1.2345,56', 'agrupamento inválido (4 dígitos)'],
    ['1234.567', 'agrupamento inválido sem milhar'],
    ['1..234,56', 'pontos duplicados'],
    ['1,,5', 'vírgulas duplicadas'],
    [',5', 'sem parte inteira'],
    ['5,', 'vírgula sem decimais'],
    ['1 234,56', 'espaço interno'],
    ['R$', 'apenas símbolo'],
  ];
  for (const [entrada, motivo] of invalidos) {
    it(`rejeita "${entrada}" (${motivo})`, () => {
      expect(parseBRLToCents(entrada).ok).toBe(false);
    });
  }
  it('rejeita valor acima de MAX_SAFE_INTEGER', () => {
    const grande = String(Number.MAX_SAFE_INTEGER) + '00'; // centavos > MAX_SAFE
    expect(parseBRLToCents(grande).ok).toBe(false);
  });
});

describe('formatCentsBRL', () => {
  const casos: ReadonlyArray<readonly [number, string]> = [
    [0, 'R$ 0,00'],
    [1, 'R$ 0,01'],
    [610, 'R$ 6,10'],
    [123456, 'R$ 1.234,56'],
  ];
  for (const [valor, esperado] of casos) {
    it(`${valor} -> ${esperado}`, () => {
      expect(formatCentsBRL(valor as Cents)).toBe(esperado);
    });
  }
  it('rejeita negativo', () => {
    expect(() => formatCentsBRL(-1 as Cents)).toThrow(RangeError);
  });
});
