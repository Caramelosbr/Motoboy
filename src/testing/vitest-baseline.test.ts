/**
 * Etapa 3B-0 — teste mínimo de infraestrutura do Vitest.
 *
 * Objetivo: comprovar que o runner funciona com TypeScript, no ambiente Node,
 * com imports explícitos e assertions. NÃO contém regra de negócio, moeda,
 * FIFO, validações, DOM, Firebase nem qualquer entidade financeira.
 */
import { describe, it, expect } from 'vitest';

describe('vitest baseline', () => {
  it('executa assertions em TypeScript', () => {
    const soma = (a: number, b: number): number => a + b;
    expect(soma(2, 3)).toBe(5);
  });

  it('roda no ambiente Node (sem DOM)', () => {
    expect(typeof process).toBe('object');
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });
});
