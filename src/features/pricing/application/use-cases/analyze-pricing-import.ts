/**
 * Caso de uso: ANALISAR uma importação da Tabela de deslocamento (DEC-020.3A).
 *
 * Só análise: carrega a tabela ativa (uma vez), valida o snapshot, roda o parser
 * e — apenas com parse limpo — o diff. Nunca publica/grava. Mensagens genéricas
 * e neutras (sem marcação visual, rastro de pilha ou detalhe de infra). Direção
 * application → domain.
 */

import {
  validatePricingArea,
  MAX_PRICING_AREAS,
  parsePricingTablePaste,
  diffPricingTable,
  type PricingPasteParseResult,
  type PricingPasteFatalCode,
  type PricingTableDiffResult,
} from '../../domain';
import type {
  PricingTableReadRepository,
  ActivePricingTableSnapshot,
} from '../ports/pricing-table-read-repository';

type CleanParse = Extract<PricingPasteParseResult, { ok: true }>;
type DiffOk = Extract<PricingTableDiffResult, { ok: true }>;
type DiffError = Extract<PricingTableDiffResult, { ok: false }>;

export type PricingImportAnalysisResult =
  | { readonly state: 'read_error'; readonly message: string }
  | {
      readonly state: 'invalid_snapshot';
      readonly code: 'INVALID_ACTIVE_SNAPSHOT';
      readonly message: string;
      readonly detail: string;
    }
  | {
      readonly state: 'invalid_input';
      readonly message: string;
      readonly fatalCode: PricingPasteFatalCode;
    }
  | {
      readonly state: 'review_required';
      readonly reason: 'parser_issues';
      readonly message: string;
      readonly activeVersionId: string | null;
      readonly revision: number;
      readonly snapshot: ActivePricingTableSnapshot;
      readonly parse: CleanParse;
    }
  | {
      readonly state: 'review_required';
      readonly reason: 'diff_conflicts';
      readonly message: string;
      readonly activeVersionId: string | null;
      readonly revision: number;
      readonly snapshot: ActivePricingTableSnapshot;
      readonly parse: CleanParse;
      readonly diff: DiffOk;
    }
  | { readonly state: 'analysis_error'; readonly message: string; readonly diffError: DiffError }
  | {
      readonly state: 'ready';
      readonly message: string;
      readonly activeVersionId: string | null;
      readonly revision: number;
      readonly snapshot: ActivePricingTableSnapshot;
      readonly parse: CleanParse;
      readonly diff: DiffOk;
    };

const MSG = {
  read: 'Não foi possível carregar a tabela ativa.',
  snapshot: 'A tabela ativa está inconsistente.',
  input: 'O texto de importação é inválido.',
  review: 'Há pendências a revisar antes de prosseguir.',
  analysis: 'Não foi possível analisar a importação.',
  ready: 'Importação analisada e pronta para revisão final.',
} as const;

// Valida o snapshot da tabela ativa SEM mutar nada. Retorna a causa (detail neutro).
function snapshotProblem(s: ActivePricingTableSnapshot): string | null {
  if (!Number.isSafeInteger(s.revision) || s.revision < 0) return 'revision';
  const v = s.activeVersionId;
  // trim SÓ para checar vazio semântico ("", espaços, tab, quebra de linha).
  // Não muta/normaliza o snapshot: a comparação usa uma cópia trimada descartável.
  if (!(v === null || (typeof v === 'string' && v.trim().length > 0))) return 'activeVersionId';
  if (typeof v === 'string' && v.includes('/')) return 'activeVersionId';
  if (v === null && s.areas.length > 0) return 'activeVersionId_null_with_areas';
  if (s.areas.length > MAX_PRICING_AREAS) return 'too_many_areas';
  const seen = new Set<string>();
  for (const area of s.areas) {
    if (!validatePricingArea(area).ok) return 'invalid_area';
    if (seen.has(area.id)) return 'duplicate_area_id';
    seen.add(area.id);
  }
  return null;
}

export async function analyzePricingImport(
  repository: PricingTableReadRepository,
  rawText: string,
): Promise<PricingImportAnalysisResult> {
  // 1) carregar a tabela ativa UMA vez; 2/3) tratar READ_FAILED e rejeição inesperada.
  let read;
  try {
    read = await repository.loadActivePricingTable();
  } catch {
    return { state: 'read_error', message: MSG.read };
  }
  if (!read.ok) return { state: 'read_error', message: MSG.read };

  const snapshot = read.value;

  // 4) validar o snapshot (detecta tabela corrompida mesmo com importação bloqueada).
  const problem = snapshotProblem(snapshot);
  if (problem) {
    return { state: 'invalid_snapshot', code: 'INVALID_ACTIVE_SNAPSHOT', message: MSG.snapshot, detail: problem };
  }

  // 5) parsear o texto colado.
  const parse = parsePricingTablePaste(rawText);

  // 6) parse fatal -> invalid_input (sem diff).
  if (!parse.ok) {
    return { state: 'invalid_input', message: MSG.input, fatalCode: parse.fatal.code };
  }

  // 7) parser com pendências -> review_required (parser_issues), sem diff.
  if (parse.issues.length > 0 || parse.unparsed.length > 0 || parse.canPublish !== true) {
    return {
      state: 'review_required',
      reason: 'parser_issues',
      message: MSG.review,
      activeVersionId: snapshot.activeVersionId,
      revision: snapshot.revision,
      snapshot,
      parse,
    };
  }

  // 8) parse limpo -> diff.
  const diff = diffPricingTable(snapshot.areas, parse);

  // 9) erro do diff -> analysis_error.
  if (!diff.ok) {
    return { state: 'analysis_error', message: MSG.analysis, diffError: diff };
  }

  // 10) conflitos -> review_required (diff_conflicts), com diff.
  if (diff.conflicts.length > 0 || diff.canPublish !== true) {
    return {
      state: 'review_required',
      reason: 'diff_conflicts',
      message: MSG.review,
      activeVersionId: snapshot.activeVersionId,
      revision: snapshot.revision,
      snapshot,
      parse,
      diff,
    };
  }

  // 11) tudo limpo -> ready.
  return {
    state: 'ready',
    message: MSG.ready,
    activeVersionId: snapshot.activeVersionId,
    revision: snapshot.revision,
    snapshot,
    parse,
    diff,
  };
}
