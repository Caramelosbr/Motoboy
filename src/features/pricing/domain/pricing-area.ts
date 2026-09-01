/**
 * Entidade de domínio PricingArea (pura, readonly) — item da Tabela de
 * deslocamento (DEC-020). Reutiliza `Cents` de shared/currency; dinheiro nunca
 * em float. A identidade oficial é o `id` (fornecido pela camada autoritativa
 * futura); `nameNormalized`/`aliases` servem só para busca/dedupe.
 *
 * Falhas de negócio usam Result discriminado — nunca exceções.
 */

import { type Cents, toCents } from '../../../shared/currency';
import { normalizePricingName } from './normalize-pricing-name';

export type PricingAreaType =
  | 'bairro'
  | 'area'
  | 'condominio'
  | 'empresa'
  | 'ponto_referencia';

export interface PricingArea {
  readonly id: string;
  readonly displayName: string;
  readonly nameNormalized: string;
  readonly aliases: readonly string[];
  readonly type?: PricingAreaType;
  readonly amountCents: Cents;
}

/** Entrada de criação — NÃO aceita `nameNormalized` (é calculado internamente). */
export interface NewPricingArea {
  readonly id: string;
  readonly displayName: string;
  readonly aliases?: readonly string[];
  readonly type?: PricingAreaType;
  readonly amountCents: Cents;
}

// Limites oficiais da feature (consumidos futuramente pela publicação).
export const MAX_PRICING_AREAS = 300;
export const MAX_PRICING_AREA_ID_LENGTH = 128;
export const MAX_PRICING_DISPLAY_NAME_LENGTH = 120;
export const MAX_PRICING_ALIASES = 10;
export const MAX_PRICING_ALIAS_LENGTH = 120;

export type PricingAreaErrorCode =
  | 'EMPTY_ID'
  | 'INVALID_ID'
  | 'ID_TOO_LONG'
  | 'EMPTY_DISPLAY_NAME'
  | 'DISPLAY_NAME_TOO_LONG'
  | 'INVALID_NORMALIZED_NAME'
  | 'INVALID_AMOUNT'
  | 'INVALID_TYPE'
  | 'TOO_MANY_ALIASES'
  | 'EMPTY_ALIAS'
  | 'ALIAS_TOO_LONG'
  | 'INVALID_NORMALIZED_ALIAS'
  | 'DUPLICATE_ALIAS'
  | 'ALIAS_EQUALS_NAME';

export type PricingAreaValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: PricingAreaErrorCode; readonly message: string };

export type PricingAreaResult =
  | { readonly ok: true; readonly value: PricingArea }
  | { readonly ok: false; readonly code: PricingAreaErrorCode; readonly message: string };

const PRICING_AREA_TYPES: readonly PricingAreaType[] = [
  'bairro',
  'area',
  'condominio',
  'empresa',
  'ponto_referencia',
];

function err(code: PricingAreaErrorCode, message: string): { ok: false; code: PricingAreaErrorCode; message: string } {
  return { ok: false, code, message };
}

// Reusa o contrato de Cents (fonte única em shared/currency) sem lançar exceção.
function isCents(n: number): n is Cents {
  try {
    toCents(n);
    return true;
  } catch {
    return false;
  }
}

/** Erro do `id` (obrigatório, ≤128, sem "/", não "."/".." e sem padrão `__…__`). */
function idErrorCode(id: unknown): PricingAreaErrorCode | null {
  if (typeof id !== 'string' || id.length === 0) return 'EMPTY_ID';
  if (id.length > MAX_PRICING_AREA_ID_LENGTH) return 'ID_TOO_LONG';
  if (id.includes('/') || id === '.' || id === '..') return 'INVALID_ID';
  if (id.startsWith('__') && id.endsWith('__')) return 'INVALID_ID';
  return null;
}

function isValidType(type: unknown): type is PricingAreaType {
  return typeof type === 'string' && (PRICING_AREA_TYPES as readonly string[]).includes(type);
}

/**
 * Valida e normaliza os aliases fornecidos (já sabendo o nome normalizado).
 * Retorna a lista NORMALIZADA (cópia) ou um erro discriminado.
 */
function buildAliases(
  aliases: readonly string[] | undefined,
  nameNormalized: string,
): { ok: true; value: string[] } | { ok: false; code: PricingAreaErrorCode; message: string } {
  if (aliases === undefined) return { ok: true, value: [] };
  if (aliases.length > MAX_PRICING_ALIASES) {
    return err('TOO_MANY_ALIASES', `no máximo ${MAX_PRICING_ALIASES} aliases.`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of aliases) {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return err('EMPTY_ALIAS', 'alias vazio.');
    }
    if (raw.length > MAX_PRICING_ALIAS_LENGTH) {
      return err('ALIAS_TOO_LONG', `alias acima de ${MAX_PRICING_ALIAS_LENGTH} caracteres.`);
    }
    const norm = normalizePricingName(raw);
    if (norm.length === 0) return err('EMPTY_ALIAS', 'alias sem conteúdo após normalização.');
    if (norm === nameNormalized) return err('ALIAS_EQUALS_NAME', 'alias igual ao nome principal.');
    if (seen.has(norm)) return err('DUPLICATE_ALIAS', `alias duplicado: "${norm}".`);
    seen.add(norm);
    out.push(norm);
  }
  return { ok: true, value: out };
}

/**
 * Valida aliases JÁ PERSISTIDOS (fronteira de persistência): cada alias precisa
 * estar na forma canônica (`alias === normalizePricingName(alias)`). NÃO corrige
 * nem altera o alias — apenas valida e rejeita entidades externas malformadas.
 */
function validatePersistedAliases(
  aliases: readonly string[],
  nameNormalized: string,
): PricingAreaValidation {
  if (!Array.isArray(aliases)) return err('EMPTY_ALIAS', 'aliases inválido.');
  if (aliases.length > MAX_PRICING_ALIASES) {
    return err('TOO_MANY_ALIASES', `no máximo ${MAX_PRICING_ALIASES} aliases.`);
  }
  const seen = new Set<string>();
  for (const alias of aliases) {
    if (typeof alias !== 'string' || alias.trim().length === 0) {
      return err('EMPTY_ALIAS', 'alias vazio.');
    }
    if (alias.length > MAX_PRICING_ALIAS_LENGTH) {
      return err('ALIAS_TOO_LONG', `alias acima de ${MAX_PRICING_ALIAS_LENGTH} caracteres.`);
    }
    if (alias !== normalizePricingName(alias)) {
      return err('INVALID_NORMALIZED_ALIAS', `alias fora da forma canônica: "${alias}".`);
    }
    if (alias === nameNormalized) {
      return err('ALIAS_EQUALS_NAME', 'alias igual ao nome principal.');
    }
    if (seen.has(alias)) return err('DUPLICATE_ALIAS', `alias duplicado: "${alias}".`);
    seen.add(alias);
  }
  return { ok: true };
}

/**
 * Cria uma PricingArea validada a partir de um input neutro. Calcula
 * `nameNormalized` internamente, normaliza os aliases fornecidos e não muta o
 * input. Não gera `id` (ele vem da camada autoritativa).
 */
export function createPricingArea(input: NewPricingArea): PricingAreaResult {
  const idCode = idErrorCode(input.id);
  if (idCode) return err(idCode, 'id inválido.');

  const displayName = typeof input.displayName === 'string' ? input.displayName : '';
  if (displayName.trim().length === 0) return err('EMPTY_DISPLAY_NAME', 'displayName vazio.');
  if (displayName.length > MAX_PRICING_DISPLAY_NAME_LENGTH) {
    return err('DISPLAY_NAME_TOO_LONG', `displayName acima de ${MAX_PRICING_DISPLAY_NAME_LENGTH} caracteres.`);
  }

  const nameNormalized = normalizePricingName(displayName);
  if (nameNormalized.length === 0) {
    return err('INVALID_NORMALIZED_NAME', 'displayName não produz um nome normalizável.');
  }

  if (!isCents(input.amountCents) || (input.amountCents as number) <= 0) {
    return err('INVALID_AMOUNT', 'amountCents deve ser inteiro (centavos) maior que zero.');
  }

  if (input.type !== undefined && !isValidType(input.type)) {
    return err('INVALID_TYPE', 'type inválido.');
  }

  const aliasesResult = buildAliases(input.aliases, nameNormalized);
  if (!aliasesResult.ok) return aliasesResult;

  const area: PricingArea = {
    id: input.id,
    displayName,
    nameNormalized,
    aliases: aliasesResult.value,
    ...(input.type !== undefined ? { type: input.type } : {}),
    amountCents: input.amountCents,
  };
  return { ok: true, value: area };
}

/** Valida uma PricingArea já montada (inclusive a coerência de `nameNormalized`). */
export function validatePricingArea(area: PricingArea): PricingAreaValidation {
  const idCode = idErrorCode(area.id);
  if (idCode) return err(idCode, 'id inválido.');

  if (typeof area.displayName !== 'string' || area.displayName.trim().length === 0) {
    return err('EMPTY_DISPLAY_NAME', 'displayName vazio.');
  }
  if (area.displayName.length > MAX_PRICING_DISPLAY_NAME_LENGTH) {
    return err('DISPLAY_NAME_TOO_LONG', `displayName acima de ${MAX_PRICING_DISPLAY_NAME_LENGTH} caracteres.`);
  }

  if (area.nameNormalized !== normalizePricingName(area.displayName) || area.nameNormalized.length === 0) {
    return err('INVALID_NORMALIZED_NAME', 'nameNormalized incoerente com displayName.');
  }

  if (!isCents(area.amountCents) || (area.amountCents as number) <= 0) {
    return err('INVALID_AMOUNT', 'amountCents deve ser inteiro (centavos) maior que zero.');
  }

  if (area.type !== undefined && !isValidType(area.type)) {
    return err('INVALID_TYPE', 'type inválido.');
  }

  return validatePersistedAliases(area.aliases, area.nameNormalized);
}
