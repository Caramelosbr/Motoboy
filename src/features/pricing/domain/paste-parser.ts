/**
 * Parser determinístico da Tabela de deslocamento (DEC-020) — puro, sem I/O.
 *
 * Interpreta uma lista colada (ex.: WhatsApp) em grupos de preço + itens, com
 * números de linha preservados. Nenhuma linha relevante desaparece em silêncio:
 * separadores reconhecidos são ignorados explicitamente; o resto vira item,
 * cabeçalho, `unparsed` ou uma issue bloqueante. Dinheiro em centavos via
 * shared/currency (nunca float); número inteiro isolado NUNCA vira preço.
 */

import { type Cents, parseBRLToCents } from '../../../shared/currency';
import { normalizePricingName } from './normalize-pricing-name';
import { MAX_PRICING_AREAS } from './pricing-area';

export const MAX_PRICING_IMPORT_TEXT_LENGTH = 50_000;
export const MAX_PRICING_IMPORT_LINES = 1_000;

export type PricingPasteFatalCode = 'EMPTY_INPUT' | 'TEXT_TOO_LONG' | 'TOO_MANY_LINES';

export type PricingPasteIssueCode =
  | 'TOO_MANY_AREAS'
  | 'AMBIGUOUS_PRICE_HEADER'
  | 'INVALID_PRICE'
  | 'NO_ACTIVE_PRICE'
  | 'AMBIGUOUS_GROUPING'
  | 'POSSIBLE_ALIAS'
  | 'ALIAS_CONFLICT_IN_PASTE'
  | 'DUPLICATE_IN_PASTE'
  | 'DUPLICATE_WITH_DIFFERENT_PRICE'
  | 'UNPARSED_LINE';

export type PricingPriceSource = 'group' | 'inline';

export interface ParsedPricingItem {
  readonly lineNumber: number;
  readonly rawLine: string;
  readonly displayName: string;
  readonly nameNormalized: string;
  readonly amountCents: Cents | null; // null quando sem preço ativo / preço inválido
  readonly priceSource: PricingPriceSource;
  readonly groupIndex: number | null;
}

export interface ParsedPriceGroup {
  readonly index: number;
  readonly amountCents: Cents;
  readonly headerLineNumber: number;
  readonly rawLine: string;
}

export interface PricingPasteIssue {
  readonly code: PricingPasteIssueCode;
  readonly lineNumber: number | null;
  readonly lineNumbers?: readonly number[];
  readonly message: string;
  readonly detail?: string;
}

export interface ParsedUnparsedLine {
  readonly lineNumber: number;
  readonly rawLine: string;
}

export type PricingPasteParseResult =
  | { readonly ok: false; readonly fatal: { readonly code: PricingPasteFatalCode; readonly message: string } }
  | {
      readonly ok: true;
      readonly items: readonly ParsedPricingItem[];
      readonly groups: readonly ParsedPriceGroup[];
      readonly issues: readonly PricingPasteIssue[];
      readonly unparsed: readonly ParsedUnparsedLine[];
      readonly canPublish: boolean;
    };

// ---------- helpers puros ----------

// Decorações iniciais: espaços, bullets, travessões usados como bullet e emojis.
// Fonte ASCII inequívoca (inclui variation selector U+FE0F e ZWJ U+200D).
const LEAD_DECORATION = new RegExp(
  '^(?:[\\s\\u2022*\\u00B7\\u25AA\\u25E6\\u25CF\\u2023\\u2043\\u2219\\u2013\\u2014-]' +
    '|\\p{Extended_Pictographic}|\\uFE0F|\\u200D)+',
  'u',
);
function stripLeadingDecoration(s: string): string {
  return s.replace(LEAD_DECORATION, '');
}

// Cabeçalho: a linha inteira (após decoração e ":" final) é um valor monetário.
const HEADER_CURRENCY = /^R\$\s*(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/i;
const HEADER_COMMA_DECIMAL = /^(?:\d{1,3}(?:\.\d{3})*|\d+),\d{1,2}$/;
const BARE_NUMBER = /^(?:\d{1,3}(?:\.\d{3})*|\d+)$/;

// Separador: sem letras nem números (só pontuação/símbolos/espaços).
const HAS_ALNUM = /[\p{L}\p{N}]/u;
function isSeparatorLine(trimmed: string): boolean {
  return trimmed.length > 0 && !HAS_ALNUM.test(trimmed);
}

// Preço inline (formato monetário inequívoco). Retorna { name, token } ou null.
const INLINE_WITH_CURRENCY = /^(.*?)\s*[—–\-:|]?\s*(R\$\s*(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?)\s*$/i;
const INLINE_SEP_DECIMAL = /^(.*?)\s*[—–\-:|]\s*((?:\d{1,3}(?:\.\d{3})*|\d+),\d{1,2})\s*$/;
const HAS_LETTER = /\p{L}/u;
function extractInline(text: string): { name: string; token: string } | null {
  const a = text.match(INLINE_WITH_CURRENCY);
  if (a && HAS_LETTER.test(a[1])) return { name: a[1].trim(), token: a[2] };
  const b = text.match(INLINE_SEP_DECIMAL);
  if (b && HAS_LETTER.test(b[1])) return { name: b[1].trim(), token: b[2] };
  return null;
}

// Agrupamento ambíguo — SÓ padrões claros (nunca por conter a conjunção "e").
const AMBIGUOUS_GROUPING_PATTERNS: readonly RegExp[] = [
  /\bi\s*(?:e|\/)\s*ii\b/i, // I e II, I/II
  /\b\d\s*(?:e|\/)\s*\d\b/, // 1 e 2, 1/2
  /\b[a-z]\s*(?:e|\/)\s*[a-z]\b/i, // Bloco A e B, A/B
];
// Remove só os acentos (mantém "/", espaços e pontuação). Necessário porque o
// `\b` do JS é ASCII: um acento criaria fronteira de palavra falsa e faria
// "Saúde e Paz" casar o padrão de letra única. Não altera normalizePricingName.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
function deaccent(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS, '');
}
function isAmbiguousGrouping(displayName: string): boolean {
  const s = deaccent(displayName);
  return AMBIGUOUS_GROUPING_PATTERNS.some((re) => re.test(s));
}

// Alias explícito — extrai o nome anterior (nunca cria alias sozinho).
const ALIAS_PATTERNS: readonly RegExp[] = [
  /\((?:antiga|antigo)\s+([^)]+)\)/i,
  /\banteriormente\s+(.+)$/i,
];
function extractPossibleAlias(displayName: string): string | null {
  for (const re of ALIAS_PATTERNS) {
    const m = displayName.match(re);
    if (m && m[1] && normalizePricingName(m[1]).length > 0) return normalizePricingName(m[1]);
  }
  return null;
}

function splitLines(raw: string): string[] {
  return raw.split(/\r\n|\r|\n/);
}

/**
 * Interpreta o texto colado. Retorna falha fatal ou o conjunto
 * itens/grupos/issues/unparsed + canPublish (true só sem issues).
 */
export function parsePricingTablePaste(rawText: string): PricingPasteParseResult {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { ok: false, fatal: { code: 'EMPTY_INPUT', message: 'Texto vazio.' } };
  }
  if (rawText.length > MAX_PRICING_IMPORT_TEXT_LENGTH) {
    return { ok: false, fatal: { code: 'TEXT_TOO_LONG', message: `Texto acima de ${MAX_PRICING_IMPORT_TEXT_LENGTH} caracteres.` } };
  }
  const lines = splitLines(rawText);
  if (lines.length > MAX_PRICING_IMPORT_LINES) {
    return { ok: false, fatal: { code: 'TOO_MANY_LINES', message: `Acima de ${MAX_PRICING_IMPORT_LINES} linhas.` } };
  }

  const items: ParsedPricingItem[] = [];
  const groups: ParsedPriceGroup[] = [];
  const issues: PricingPasteIssue[] = [];
  const unparsed: ParsedUnparsedLine[] = [];
  const possibleAliases: { lineNumber: number; previousNorm: string }[] = [];

  let activePrice: Cents | null = null;
  let activeGroupIndex: number | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    if (trimmed === '' || isSeparatorLine(trimmed)) continue; // linhas vazias / separadores

    const headerCore = stripLeadingDecoration(trimmed).replace(/:\s*$/, '').trim();

    // Cabeçalho de preço (linha inteira é moeda com R$ ou vírgula-decimal).
    if (HEADER_CURRENCY.test(headerCore) || HEADER_COMMA_DECIMAL.test(headerCore)) {
      const parsed = parseBRLToCents(headerCore);
      if (!parsed.ok || (parsed.value as number) <= 0) {
        issues.push({ code: 'INVALID_PRICE', lineNumber, message: 'Preço de cabeçalho inválido.', detail: headerCore });
      } else {
        activeGroupIndex = groups.length;
        activePrice = parsed.value;
        groups.push({ index: activeGroupIndex, amountCents: parsed.value, headerLineNumber: lineNumber, rawLine });
      }
      continue;
    }
    // Inteiro isolado sem R$ ("20", "060", "1.234") — ambíguo, nunca preço.
    if (BARE_NUMBER.test(headerCore)) {
      issues.push({ code: 'AMBIGUOUS_PRICE_HEADER', lineNumber, message: 'Número isolado sem R$: ambíguo.', detail: headerCore });
      continue;
    }

    // ---- linha de área ----
    const nameRaw = stripLeadingDecoration(trimmed).replace(/\s+$/, '');
    const inline = extractInline(nameRaw);

    let displayName: string;
    let amountCents: Cents | null;
    let priceSource: PricingPriceSource;
    let groupIndex: number | null;

    if (inline) {
      displayName = inline.name;
      const priceParsed = parseBRLToCents(inline.token);
      if (!priceParsed.ok || (priceParsed.value as number) <= 0) {
        amountCents = null;
        issues.push({ code: 'INVALID_PRICE', lineNumber, message: 'Preço inline inválido.', detail: inline.token });
      } else {
        amountCents = priceParsed.value;
      }
      priceSource = 'inline';
      groupIndex = activeGroupIndex; // inline não altera o grupo ativo
    } else {
      displayName = nameRaw;
      priceSource = 'group';
      if (activePrice === null) {
        amountCents = null;
        groupIndex = null;
        issues.push({ code: 'NO_ACTIVE_PRICE', lineNumber, message: 'Área sem preço de grupo ativo.', detail: displayName });
      } else {
        amountCents = activePrice;
        groupIndex = activeGroupIndex;
      }
    }

    const nameNormalized = normalizePricingName(displayName);
    if (nameNormalized.length === 0) {
      unparsed.push({ lineNumber, rawLine });
      issues.push({ code: 'UNPARSED_LINE', lineNumber, message: 'Linha não interpretável como área.', detail: rawLine });
      continue;
    }

    items.push({ lineNumber, rawLine, displayName, nameNormalized, amountCents, priceSource, groupIndex });

    if (isAmbiguousGrouping(displayName)) {
      issues.push({ code: 'AMBIGUOUS_GROUPING', lineNumber, message: 'Agrupamento ambíguo (ex.: "I e II").', detail: displayName });
    }
    const previousNorm = extractPossibleAlias(displayName);
    if (previousNorm) {
      possibleAliases.push({ lineNumber, previousNorm });
      issues.push({ code: 'POSSIBLE_ALIAS', lineNumber, message: 'Possível alias explícito.', detail: previousNorm });
    }
  }

  // Limite de áreas.
  if (items.length > MAX_PRICING_AREAS) {
    issues.push({ code: 'TOO_MANY_AREAS', lineNumber: null, message: `Acima de ${MAX_PRICING_AREAS} áreas reconhecidas.` });
  }

  // Índice por nome normalizado.
  const byNorm = new Map<string, ParsedPricingItem[]>();
  for (const it of items) {
    const arr = byNorm.get(it.nameNormalized);
    if (arr) arr.push(it);
    else byNorm.set(it.nameNormalized, [it]);
  }

  // Conflito de alias no colado: o possível alias também é um item independente.
  for (const pa of possibleAliases) {
    const conflicts = (byNorm.get(pa.previousNorm) ?? []).filter((it) => it.lineNumber !== pa.lineNumber);
    if (conflicts.length > 0) {
      issues.push({
        code: 'ALIAS_CONFLICT_IN_PASTE',
        lineNumber: pa.lineNumber,
        lineNumbers: [pa.lineNumber, ...conflicts.map((c) => c.lineNumber)].sort((a, b) => a - b),
        message: 'Possível alias coincide com um item independente.',
        detail: pa.previousNorm,
      });
    }
  }

  // Duplicidades por nome normalizado.
  for (const [norm, group] of byNorm) {
    if (group.length < 2) continue;
    const lineNumbers = group.map((g) => g.lineNumber).sort((a, b) => a - b);
    const first = group[0].amountCents;
    const mesmoPreco = group.every((g) => g.amountCents === first);
    issues.push({
      code: mesmoPreco ? 'DUPLICATE_IN_PASTE' : 'DUPLICATE_WITH_DIFFERENT_PRICE',
      lineNumber: lineNumbers[0],
      lineNumbers,
      message: mesmoPreco ? 'Item duplicado no colado.' : 'Item duplicado com preços diferentes.',
      detail: norm,
    });
  }

  // Ordenação determinística das issues.
  issues.sort((a, b) => {
    const la = a.lineNumber ?? Number.MAX_SAFE_INTEGER;
    const lb = b.lineNumber ?? Number.MAX_SAFE_INTEGER;
    if (la !== lb) return la - lb;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return 0;
  });

  return { ok: true, items, groups, issues, unparsed, canPublish: issues.length === 0 };
}
