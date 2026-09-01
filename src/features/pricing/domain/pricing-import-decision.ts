/**
 * Decisões humanas de resolução da importação (DEC-020.3B-1) — puro, sem I/O.
 *
 * Esta etapa SÓ valida (cobertura, compatibilidade, stale, needs_reanalysis).
 * Não aplica decisões, não constrói proposta, não executa diff. Nenhum id de
 * PricingArea é gerado. Result discriminado; sem exceções de negócio; sem
 * default automático; validação defensiva (não confia no TypeScript em runtime).
 */

import type {
  ParsedPricingItem,
  ParsedUnparsedLine,
  PricingPasteIssue,
  PricingPasteIssueCode,
  PricingPasteParseResult,
} from './paste-parser';
import { normalizePricingName } from './normalize-pricing-name';
import { MAX_PRICING_ALIAS_LENGTH, MAX_PRICING_DISPLAY_NAME_LENGTH } from './pricing-area';
import { buildPricingAnalysisKey } from './pricing-analysis-key';

// ---------- Issue references (Parte 2) ----------

export interface PricingIssueReference {
  readonly issueId: string;
  readonly issueIndex: number;
  readonly code: PricingPasteIssueCode;
  readonly lineNumber: number | null;
  readonly lineNumbers: readonly number[] | null;
  readonly analysisKey: string;
}

function issueIdOf(index: number, code: string, lineNumber: number | null, lineNumbers: readonly number[] | null): string {
  const lines = lineNumbers !== null ? lineNumbers.join('-') : lineNumber !== null ? String(lineNumber) : 'none';
  return `issue:${index}:${code}:${lines}`;
}

/** Descritores determinísticos das issues do parse, ligados à analysisKey atual. */
export function buildIssueReferences(
  issues: readonly PricingPasteIssue[],
  analysisKey: string,
): readonly PricingIssueReference[] {
  return issues.map((is, index) => {
    const lineNumber = is.lineNumber === undefined ? null : is.lineNumber;
    const lineNumbers = is.lineNumbers === undefined ? null : [...is.lineNumbers]; // cópia, nunca muta
    return { issueId: issueIdOf(index, is.code, lineNumber, lineNumbers), issueIndex: index, code: is.code, lineNumber, lineNumbers, analysisKey };
  });
}

// ---------- Tipos de decisão (Parte 3) ----------

export type PricingImportDecision =
  | { readonly kind: 'KeepGroupingAsSingleArea'; readonly issueId: string }
  | { readonly kind: 'SplitGroupingIntoAreas'; readonly issueId: string; readonly names: readonly string[] }
  | { readonly kind: 'KeepPossibleAliasLiteral'; readonly issueId: string }
  | { readonly kind: 'RegisterAlias'; readonly issueId: string; readonly targetLineNumber: number; readonly alias: string }
  | { readonly kind: 'KeepConflictSeparate'; readonly issueIds: readonly string[] }
  | { readonly kind: 'ConsolidateDuplicate'; readonly issueId: string; readonly keepLineNumber: number }
  | { readonly kind: 'ChooseDuplicateVariant'; readonly issueId: string; readonly keepLineNumber: number }
  | { readonly kind: 'ExcludeLine'; readonly issueId: string; readonly lineNumber: number; readonly reason: string };

// Matriz de compatibilidade issue → decisões de item único (KeepConflictSeparate à parte).
const COMPAT: Readonly<Record<string, ReadonlySet<string>>> = {
  AMBIGUOUS_GROUPING: new Set(['KeepGroupingAsSingleArea', 'SplitGroupingIntoAreas']),
  POSSIBLE_ALIAS: new Set(['KeepPossibleAliasLiteral', 'RegisterAlias']),
  ALIAS_CONFLICT_IN_PASTE: new Set(['KeepConflictSeparate']),
  DUPLICATE_IN_PASTE: new Set(['ConsolidateDuplicate']),
  DUPLICATE_WITH_DIFFERENT_PRICE: new Set(['ChooseDuplicateVariant']),
  UNPARSED_LINE: new Set(['ExcludeLine']),
};
const RESOLVABLE_CODES: ReadonlySet<string> = new Set(Object.keys(COMPAT));

// ---------- Result da validação (Parte 5) ----------

export type PricingImportDecisionsErrorCode =
  | 'INVALID_ANALYSIS'
  | 'STALE_ANALYSIS_KEY'
  | 'UNKNOWN_ISSUE'
  | 'MISSING_DECISION'
  | 'DUPLICATE_COVERAGE'
  | 'INCOMPATIBLE_DECISION'
  | 'INVALID_DECISION_PAYLOAD'
  | 'INVALID_CONFLICT_CLUSTER';

export type PricingImportDecisionsResult =
  | { readonly ok: true; readonly state: 'valid' }
  | {
      readonly ok: false;
      readonly state: 'resolution_invalid';
      readonly code: PricingImportDecisionsErrorCode;
      readonly message: string;
      readonly detail?: string;
    }
  | {
      readonly ok: false;
      readonly state: 'needs_reanalysis';
      readonly blocking: readonly PricingIssueReference[];
      readonly message: string;
    };

export interface ValidatePricingImportDecisionsInput {
  readonly rawText: string;
  readonly parse: PricingPasteParseResult;
  readonly expectedAnalysisKey: string;
  readonly decisions: readonly PricingImportDecision[];
}

function invalid(code: PricingImportDecisionsErrorCode, message: string, detail?: string): PricingImportDecisionsResult {
  return detail === undefined
    ? { ok: false, state: 'resolution_invalid', code, message }
    : { ok: false, state: 'resolution_invalid', code, message, detail };
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function itemByLine(parse: Extract<PricingPasteParseResult, { ok: true }>, line: number): ParsedPricingItem | undefined {
  return parse.items.find((i) => i.lineNumber === line);
}
function unparsedByLine(parse: Extract<PricingPasteParseResult, { ok: true }>, line: number): ParsedUnparsedLine | undefined {
  return parse.unparsed.find((u) => u.lineNumber === line);
}
function isPositiveCents(n: unknown): boolean {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}

type DecisionOutcome =
  | { readonly ok: true; readonly coveredIssueIds: readonly string[] }
  | { readonly ok: false; readonly code: PricingImportDecisionsErrorCode; readonly detail?: string };

function fail(code: PricingImportDecisionsErrorCode, detail?: string): DecisionOutcome {
  return { ok: false, code, detail };
}

/** Valida uma decisão isolada; devolve as issues que ela cobre ou o erro. */
function validateDecision(
  d: PricingImportDecision,
  refByIssueId: ReadonlyMap<string, PricingIssueReference>,
  parse: Extract<PricingPasteParseResult, { ok: true }>,
): DecisionOutcome {
  if (d === null || typeof d !== 'object' || !isStr((d as { kind?: unknown }).kind)) {
    return fail('INVALID_DECISION_PAYLOAD', 'decisão malformada');
  }

  // KeepConflictSeparate cobre um cluster de issueIds.
  if (d.kind === 'KeepConflictSeparate') {
    if (!Array.isArray(d.issueIds) || d.issueIds.length === 0 || !d.issueIds.every(isStr)) {
      return fail('INVALID_DECISION_PAYLOAD', 'issueIds inválidos');
    }
    const seen = new Set<string>();
    const refs: PricingIssueReference[] = [];
    for (const id of d.issueIds) {
      if (seen.has(id)) return fail('INVALID_CONFLICT_CLUSTER', 'issueId repetido no cluster');
      seen.add(id);
      const ref = refByIssueId.get(id);
      if (!ref) return fail('UNKNOWN_ISSUE', id);
      if (ref.code !== 'ALIAS_CONFLICT_IN_PASTE' && ref.code !== 'POSSIBLE_ALIAS') {
        return fail('INVALID_CONFLICT_CLUSTER', 'código fora do cluster: ' + ref.code);
      }
      refs.push(ref);
    }
    const conflicts = refs.filter((r) => r.code === 'ALIAS_CONFLICT_IN_PASTE');
    if (conflicts.length !== 1) return fail('INVALID_CONFLICT_CLUSTER', 'exige exatamente um ALIAS_CONFLICT_IN_PASTE');
    const conflictLines = new Set<number>(conflicts[0].lineNumbers ?? (conflicts[0].lineNumber !== null ? [conflicts[0].lineNumber] : []));
    for (const r of refs) {
      if (r.code !== 'POSSIBLE_ALIAS') continue;
      const rl = r.lineNumbers ?? (r.lineNumber !== null ? [r.lineNumber] : []);
      if (!rl.some((ln) => conflictLines.has(ln))) {
        return fail('INVALID_CONFLICT_CLUSTER', 'POSSIBLE_ALIAS não compartilha linha do conflito');
      }
    }
    return { ok: true, coveredIssueIds: d.issueIds };
  }

  // Demais decisões cobrem uma única issue.
  if (!isStr(d.issueId)) return fail('INVALID_DECISION_PAYLOAD', 'issueId inválido');
  const ref = refByIssueId.get(d.issueId);
  if (!ref) return fail('UNKNOWN_ISSUE', d.issueId);
  const allowed = COMPAT[ref.code];
  if (!allowed || !allowed.has(d.kind)) return fail('INCOMPATIBLE_DECISION', `${d.kind} × ${ref.code}`);
  const candidateLines = ref.lineNumbers ?? (ref.lineNumber !== null ? [ref.lineNumber] : []);

  switch (d.kind) {
    case 'KeepGroupingAsSingleArea':
    case 'KeepPossibleAliasLiteral':
      return { ok: true, coveredIssueIds: [d.issueId] };

    case 'SplitGroupingIntoAreas': {
      if (!Array.isArray(d.names) || d.names.length < 2 || !d.names.every(isStr)) {
        return fail('INVALID_DECISION_PAYLOAD', 'names precisa de >= 2 strings');
      }
      const normed = new Set<string>();
      for (const name of d.names) {
        if (name.trim().length === 0 || name.length > MAX_PRICING_DISPLAY_NAME_LENGTH) {
          return fail('INVALID_DECISION_PAYLOAD', 'nome vazio ou acima do limite');
        }
        const n = normalizePricingName(name);
        if (n.length === 0) return fail('INVALID_DECISION_PAYLOAD', 'nome normaliza para vazio');
        if (normed.has(n)) return fail('INVALID_DECISION_PAYLOAD', 'nomes duplicados após normalização');
        normed.add(n);
      }
      const line = ref.lineNumber;
      const item = line !== null ? itemByLine(parse, line) : undefined;
      if (!item || !isPositiveCents(item.amountCents)) {
        return fail('INVALID_DECISION_PAYLOAD', 'issue sem item/preço válido para split');
      }
      return { ok: true, coveredIssueIds: [d.issueId] };
    }

    case 'RegisterAlias': {
      if (!isInt(d.targetLineNumber) || !isStr(d.alias)) return fail('INVALID_DECISION_PAYLOAD', 'payload de alias inválido');
      if (ref.lineNumber === null || d.targetLineNumber !== ref.lineNumber) {
        return fail('INVALID_DECISION_PAYLOAD', 'targetLineNumber não corresponde à issue');
      }
      const target = itemByLine(parse, d.targetLineNumber);
      if (!target) return fail('INVALID_DECISION_PAYLOAD', 'targetLineNumber sem item');
      if (d.alias.trim().length === 0 || d.alias.length > MAX_PRICING_ALIAS_LENGTH) {
        return fail('INVALID_DECISION_PAYLOAD', 'alias vazio ou acima do limite');
      }
      const na = normalizePricingName(d.alias);
      if (na.length === 0) return fail('INVALID_DECISION_PAYLOAD', 'alias normaliza para vazio');
      if (na === target.nameNormalized) return fail('INVALID_DECISION_PAYLOAD', 'alias igual ao nome do alvo');
      // não pode coincidir com outro item independente (qualquer preço).
      for (const other of parse.items) {
        if (other.lineNumber === d.targetLineNumber) continue;
        if (other.nameNormalized === na) return fail('INVALID_DECISION_PAYLOAD', 'alias coincide com item independente');
      }
      return { ok: true, coveredIssueIds: [d.issueId] };
    }

    case 'ConsolidateDuplicate': {
      if (!isInt(d.keepLineNumber) || !candidateLines.includes(d.keepLineNumber)) {
        return fail('INVALID_DECISION_PAYLOAD', 'keepLineNumber não é candidato');
      }
      if (!itemByLine(parse, d.keepLineNumber)) return fail('INVALID_DECISION_PAYLOAD', 'keepLineNumber sem item');
      const prices = candidateLines.map((ln) => itemByLine(parse, ln)?.amountCents);
      const first = prices[0];
      if (!prices.every((p) => p === first)) return fail('INVALID_DECISION_PAYLOAD', 'duplicados com preços diferentes');
      return { ok: true, coveredIssueIds: [d.issueId] };
    }

    case 'ChooseDuplicateVariant': {
      if (!isInt(d.keepLineNumber) || !candidateLines.includes(d.keepLineNumber)) {
        return fail('INVALID_DECISION_PAYLOAD', 'keepLineNumber não é candidato');
      }
      if (!itemByLine(parse, d.keepLineNumber)) return fail('INVALID_DECISION_PAYLOAD', 'keepLineNumber sem item');
      const distinct = new Set(candidateLines.map((ln) => itemByLine(parse, ln)?.amountCents));
      if (distinct.size < 2) return fail('INVALID_DECISION_PAYLOAD', 'não há >= 2 preços distintos');
      return { ok: true, coveredIssueIds: [d.issueId] };
    }

    case 'ExcludeLine': {
      if (!isInt(d.lineNumber) || !isStr(d.reason)) return fail('INVALID_DECISION_PAYLOAD', 'payload de exclusão inválido');
      if (ref.lineNumber === null || d.lineNumber !== ref.lineNumber) {
        return fail('INVALID_DECISION_PAYLOAD', 'lineNumber não corresponde à issue');
      }
      if (!unparsedByLine(parse, d.lineNumber)) return fail('INVALID_DECISION_PAYLOAD', 'linha não está em unparsed');
      if (d.reason.trim().length === 0) return fail('INVALID_DECISION_PAYLOAD', 'justificativa vazia');
      if (itemByLine(parse, d.lineNumber) || parse.groups.some((g) => g.headerLineNumber === d.lineNumber)) {
        return fail('INVALID_DECISION_PAYLOAD', 'não pode excluir item/grupo/cabeçalho');
      }
      return { ok: true, coveredIssueIds: [d.issueId] };
    }

    default:
      return fail('INVALID_DECISION_PAYLOAD', 'kind desconhecido');
  }
}

/**
 * Valida um conjunto de decisões contra a análise. Não aplica nada. Ordem:
 * análise → stale → needs_reanalysis → cobertura/compatibilidade/payload.
 */
export function validatePricingImportDecisions(
  input: ValidatePricingImportDecisionsInput,
): PricingImportDecisionsResult {
  const keyResult = buildPricingAnalysisKey(input.rawText, input.parse);
  if (!keyResult.ok) return invalid('INVALID_ANALYSIS', 'Análise inválida (fatal).');
  if (!input.parse.ok) return invalid('INVALID_ANALYSIS', 'Análise inválida (fatal).');

  if (!isStr(input.expectedAnalysisKey) || input.expectedAnalysisKey !== keyResult.key) {
    return invalid('STALE_ANALYSIS_KEY', 'A análise mudou desde a decisão.');
  }

  const refs = buildIssueReferences(input.parse.issues, keyResult.key);

  // needs_reanalysis ANTES de reclamar por decisões faltantes.
  const blocking = refs.filter((r) => !RESOLVABLE_CODES.has(r.code));
  if (blocking.length > 0) {
    return { ok: false, state: 'needs_reanalysis', blocking, message: 'Há pendências que exigem editar o texto e reanalisar.' };
  }

  if (!Array.isArray(input.decisions)) return invalid('INVALID_DECISION_PAYLOAD', 'decisions inválido');

  const refByIssueId = new Map<string, PricingIssueReference>();
  for (const r of refs) refByIssueId.set(r.issueId, r);

  const covered = new Set<string>();
  for (const d of input.decisions) {
    const outcome = validateDecision(d, refByIssueId, input.parse);
    if (!outcome.ok) return invalid(outcome.code, 'Decisão inválida.', outcome.detail);
    for (const id of outcome.coveredIssueIds) {
      if (covered.has(id)) return invalid('DUPLICATE_COVERAGE', 'Issue coberta mais de uma vez.', id);
      covered.add(id);
    }
  }

  for (const r of refs) {
    if (!covered.has(r.issueId)) return invalid('MISSING_DECISION', 'Issue sem decisão.', r.issueId);
  }

  return { ok: true, state: 'valid' };
}
