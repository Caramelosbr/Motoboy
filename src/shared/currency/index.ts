/**
 * API pública das primitivas de moeda (centavos inteiros). Sem default export;
 * helpers internos não são reexportados.
 */

export type { Cents } from './cents';
export { toCents, addCents, subtractCents } from './cents';

export type { ParseOk, ParseError, ParseResult } from './parse-brl';
export { parseBRLToCents } from './parse-brl';

export { formatCentsBRL } from './format-brl';
