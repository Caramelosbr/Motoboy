/**
 * Chave EXATA da análise de importação (DEC-020.3B-1) — pura, determinística.
 *
 * Constrói uma serialização canônica COMPLETA (arrays/tuplas em ordem fixa),
 * sem resumo/digest, sem relógio e sem aleatoriedade, a partir do rawText
 * original e do PricingPasteParseResult de sucesso. Comparada por igualdade
 * exata (a chave inteira, não um resumo). Serve
 * somente para consistência e detecção de análise stale no cliente — NÃO é
 * segurança nem autorização. Não muta nenhuma entrada; não normaliza rawText.
 */

import type { PricingPasteParseResult } from './paste-parser';

export type PricingAnalysisKeyResult =
  | { readonly ok: true; readonly key: string }
  | { readonly ok: false; readonly code: 'FATAL_PARSE'; readonly message: string };

// Versão do formato canônico (invalida chaves antigas se o formato mudar).
const CANONICAL_VERSION = 'pricing-analysis-key/v1';

// Serializa uma estrutura canônica composta só de string|number|boolean|null|arrays.
// Como usamos ARRAYS (ordem preservada) e nunca objetos arbitrários, JSON.stringify
// é determinístico e distingue null de "" e de ausência (sempre há um valor no slot).
function serializeCanonical(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Constrói a analysisKey a partir do texto original e do resultado do parser.
 * Parse fatal NÃO gera contexto de resolução válido.
 */
export function buildPricingAnalysisKey(
  rawText: string,
  parse: PricingPasteParseResult,
): PricingAnalysisKeyResult {
  if (!parse.ok) {
    return { ok: false, code: 'FATAL_PARSE', message: 'Análise fatal não produz chave de resolução.' };
  }

  const items = parse.items.map((i) => [
    i.lineNumber,
    i.rawLine,
    i.displayName,
    i.nameNormalized,
    i.amountCents === null ? null : (i.amountCents as number),
    i.priceSource,
    i.groupIndex === null ? null : i.groupIndex,
  ]);

  const groups = parse.groups.map((g) => [g.index, g.amountCents as number, g.headerLineNumber, g.rawLine]);

  const issues = parse.issues.map((is, index) => [
    index,
    is.code,
    is.lineNumber === null || is.lineNumber === undefined ? null : is.lineNumber,
    is.lineNumbers === undefined ? null : [...is.lineNumbers],
    is.message,
    is.detail === undefined ? null : is.detail,
  ]);

  const unparsed = parse.unparsed.map((u) => [u.lineNumber, u.rawLine]);

  const canonical = [CANONICAL_VERSION, rawText, parse.canPublish, items, groups, issues, unparsed];
  return { ok: true, key: serializeCanonical(canonical) };
}
