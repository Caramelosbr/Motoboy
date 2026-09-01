import { describe, it, expect } from 'vitest';
import { normalizePricingName } from './index';

describe('normalizePricingName — exemplos obrigatórios', () => {
  const casos: ReadonlyArray<readonly [string, string]> = [
    ['Céu Azul', 'ceu azul'],
    ['  JARDIM   EUROPA  ', 'jardim europa'],
    ['Décio 060', 'decio 060'],
    ['BR-153', 'br 153'],
    ['Milhão (antiga Kowalski)', 'milhao antiga kowalski'],
    ['Nilson Veloso I e II', 'nilson veloso i e ii'],
  ];
  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" -> "${esperado}"`, () => {
      expect(normalizePricingName(entrada)).toBe(esperado);
    });
  }
});

describe('normalizePricingName — invariantes', () => {
  it('preserva números como parte do nome (nunca preço)', () => {
    expect(normalizePricingName('Décio 060')).toBe('decio 060');
    expect(normalizePricingName('Kowalski 20')).toBe('kowalski 20');
  });
  it('acento/caixa/espaço produzem o mesmo normalizado', () => {
    expect(normalizePricingName('CÉU  AZUL')).toBe(normalizePricingName('céu azul'));
    expect(normalizePricingName('  Céu Azul ')).toBe('ceu azul');
  });
  it('pontuação e separadores viram espaço', () => {
    expect(normalizePricingName('Setor/Central')).toBe('setor central');
    expect(normalizePricingName('A—B|C:D')).toBe('a b c d');
  });
  it('string vazia / só pontuação -> vazio', () => {
    expect(normalizePricingName('   ')).toBe('');
    expect(normalizePricingName('---')).toBe('');
  });
  it('não infere alias nem divide o nome', () => {
    // "Kowalski" continua embutido no texto, não vira um item/alias próprio.
    expect(normalizePricingName('Milhão (antiga Kowalski)')).toBe('milhao antiga kowalski');
  });
  it('entrada não-string -> vazio', () => {
    expect(normalizePricingName(undefined as unknown as string)).toBe('');
  });
});
