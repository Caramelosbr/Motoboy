/**
 * Parser estrito de valores em Real (BRL) para centavos inteiros.
 *
 * A conversão é feita SOMENTE por manipulação de string e inteiros (BigInt):
 * nenhuma conversão via ponto flutuante, nenhuma multiplicação por 100 em float,
 * e a string decimal completa nunca é interpretada como número; sem
 * arredondamento silencioso.
 *
 * Erro de digitação do usuário é retorno normal (Result discriminado), não
 * exceção.
 */

import { toCents, type Cents } from './cents';

export type ParseOk = { readonly ok: true; readonly value: Cents };
export type ParseError = { readonly ok: false; readonly error: string };
export type ParseResult = ParseOk | ParseError;

function fail(error: string): ParseError {
  return { ok: false, error };
}

// Parte numérica válida (após remover "R$" e espaços externos):
// - inteiro simples: \d+  (ex.: "0", "6", "1234")
// - OU agrupamento de milhares estrito: \d{1,3}(\.\d{3})+  (ex.: "1.234")
// - decimais opcionais: ,\d{1,2}  (uma ou duas casas; três casas são rejeitadas)
const BRL_NUMERIC = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Converte uma string em formato brasileiro para `Cents`.
 * Aceita "R$" opcional e espaços externos; exige vírgula decimal e ponto de
 * milhar válidos. Retorna `{ ok:true, value }` ou `{ ok:false, error }`.
 */
export function parseBRLToCents(input: string): ParseResult {
  if (typeof input !== 'string') return fail('Entrada inválida: esperado texto.');

  const trimmed = input.trim();
  if (trimmed === '') return fail('Valor vazio.');

  // Remove prefixo "R$" (com ou sem espaço) apenas no início.
  const numeric = trimmed.replace(/^R\$\s*/, '');
  if (numeric === '') return fail('Valor vazio após o símbolo de moeda.');

  if (!BRL_NUMERIC.test(numeric)) {
    return fail('Formato monetário inválido para o padrão brasileiro.');
  }

  const [intPart, decPart] = numeric.split(',');
  const intDigits = intPart.replace(/\./g, ''); // remove separadores de milhar
  const decDigits = (decPart ?? '').padEnd(2, '0'); // "" -> "00", "1" -> "10"

  const combined = intDigits + decDigits; // string só de dígitos = total em centavos
  const asBig = BigInt(combined);
  if (asBig > MAX_SAFE) {
    return fail('Valor acima do máximo seguro suportado.');
  }

  return { ok: true, value: toCents(Number(asBig)) };
}
