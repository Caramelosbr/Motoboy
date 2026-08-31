/**
 * Tipo monetário do domínio: centavos como INTEIRO não negativo.
 *
 * Contrato:
 * - `Cents` é um inteiro `>= 0` e `<= Number.MAX_SAFE_INTEGER`.
 * - Nunca representa float, NaN, Infinity nem número negativo.
 * - O sinal financeiro (crédito/débito) NÃO é representado por número negativo;
 *   isso é responsabilidade de `direction` na camada de domínio (ver DEC-014).
 *
 * Funções puras, sem estado global e sem classes. Valores inválidos nunca são
 * silenciados: violam o contrato e lançam `RangeError` (erro previsível de
 * programação, não erro de digitação do usuário).
 */

declare const CENTS_BRAND: unique symbol;

/** Inteiro não negativo em centavos (branded para impedir mistura com number cru). */
export type Cents = number & { readonly [CENTS_BRAND]: true };

/** true se `value` é um inteiro seguro `>= 0` (base do contrato de Cents). */
function isCentsValue(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Cria/valida um `Cents` a partir de um number.
 * @throws {RangeError} se não for inteiro seguro `>= 0` (float, NaN, Infinity,
 *   negativo ou acima de Number.MAX_SAFE_INTEGER).
 */
export function toCents(value: number): Cents {
  if (!isCentsValue(value)) {
    throw new RangeError(
      `Cents inválido: esperado inteiro não negativo até ${Number.MAX_SAFE_INTEGER}, recebido ${value}.`,
    );
  }
  return value as Cents;
}

/**
 * Soma dois `Cents` com proteção contra overflow.
 * @throws {RangeError} se o resultado ultrapassar Number.MAX_SAFE_INTEGER.
 */
export function addCents(a: Cents, b: Cents): Cents {
  const sum = (a as number) + (b as number);
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError('Overflow ao somar Cents: resultado acima de Number.MAX_SAFE_INTEGER.');
  }
  return sum as Cents;
}

/**
 * Subtrai `b` de `a` sem permitir resultado negativo.
 * @throws {RangeError} se `b > a` (o domínio nunca guarda saldo negativo).
 */
export function subtractCents(a: Cents, b: Cents): Cents {
  const diff = (a as number) - (b as number);
  if (diff < 0) {
    throw new RangeError('Subtração de Cents resultaria em valor negativo.');
  }
  return diff as Cents;
}
