/**
 * Caso de uso AUTORITATIVO `publishPricingTable` (DEC-019.2) — server-side.
 *
 * Recebe `uid` confiável + entrada BRUTA e NÃO confia em nada resolvido pelo
 * cliente: reprocessa parser → resolução → diff no servidor, atribui IDs novos
 * por porta injetada (determinística), calcula um `requestHash` canônico a
 * partir da ENTRADA (estável entre retries) e delega a escrita a uma porta
 * transacional que aplica idempotência ANTES da concorrência, de forma atômica.
 *
 * Puro em relação a ambiente: sem firebase-admin, sem relógio, sem aleatório.
 * Importa apenas o núcleo compartilhado da raiz. Result discriminado.
 */

import {
  parsePricingTablePaste,
  buildPricingAnalysisKey,
  resolvePricingProposal,
  diffResolvedPricingTable,
  type PricingImportDecision,
  type PricingIssueReference,
  type ResolvedPricingDiffResult,
} from '../../../src/features/pricing/domain';
import type {
  PricingActiveTableReader,
  PricingIdGenerator,
  PricingPublishTransaction,
  PublishAreaPlan,
  PublishPlan,
  RequestHasher,
} from './ports';

export interface PublishPricingTableInput {
  readonly uid: string;
  readonly rawText: string;
  readonly decisions: readonly PricingImportDecision[];
  readonly expectedActiveVersionId: string | null;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
}

export interface PublishPricingTableDeps {
  readonly reader: PricingActiveTableReader;
  readonly ids: PricingIdGenerator;
  readonly hasher: RequestHasher;
  readonly transaction: PricingPublishTransaction;
}

export type PublishPricingTableResult =
  | { readonly state: 'invalid_input'; readonly code: 'INVALID_INPUT' | 'PARSER_FATAL'; readonly message: string; readonly detail?: string }
  | { readonly state: 'read_error'; readonly message: string }
  | { readonly state: 'needs_reanalysis'; readonly message: string; readonly blocking: readonly PricingIssueReference[] }
  | { readonly state: 'resolution_invalid'; readonly code: string; readonly message: string; readonly detail?: string }
  | { readonly state: 'review_required'; readonly reason: 'diff_conflicts'; readonly message: string }
  | { readonly state: 'analysis_error'; readonly message: string; readonly detail?: string }
  | {
      readonly state: 'published';
      readonly message: string;
      readonly versionId: string;
      readonly revision: number;
      readonly activationId: string;
      readonly idempotentReplay: boolean;
    }
  | { readonly state: 'conflict'; readonly code: 'CONCURRENT_MODIFICATION'; readonly message: string }
  | { readonly state: 'error'; readonly code: 'REQUEST_HASH_MISMATCH' | 'REJECTED'; readonly message: string }
  | { readonly state: 'offline'; readonly message: string };

const MSG = {
  invalid: 'Entrada de publicação inválida.',
  parser: 'O texto de importação é inválido.',
  read: 'Não foi possível carregar a tabela ativa.',
  needs: 'Há pendências que exigem editar o texto e reanalisar.',
  resolution: 'As decisões não resolvem a importação de forma consistente.',
  review: 'Há conflitos a revisar antes de publicar.',
  analysis: 'Não foi possível analisar a importação.',
  published: 'Publicação confirmada.',
  conflict: 'A tabela ativa mudou; recarregue e revise novamente.',
  rejected: 'A publicação foi rejeitada.',
  offline: 'A publicação não chegou ao servidor.',
} as const;

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

function isValidPointer(v: unknown): boolean {
  return v === null || (typeof v === 'string' && v.trim().length > 0 && !v.includes('/'));
}

// Serialização canônica das decisões (ordem-independente e estável).
function canonicalDecision(d: PricingImportDecision): string {
  let tuple: unknown;
  switch (d.kind) {
    case 'KeepGroupingAsSingleArea': tuple = ['KG', d.issueId]; break;
    case 'SplitGroupingIntoAreas': tuple = ['SP', d.issueId, [...d.names]]; break;
    case 'KeepPossibleAliasLiteral': tuple = ['KA', d.issueId]; break;
    case 'RegisterAlias': tuple = ['RA', d.issueId, d.targetLineNumber, d.alias]; break;
    case 'KeepConflictSeparate': tuple = ['KC', [...d.issueIds].sort()]; break;
    case 'ConsolidateDuplicate': tuple = ['CD', d.issueId, d.keepLineNumber]; break;
    case 'ChooseDuplicateVariant': tuple = ['CV', d.issueId, d.keepLineNumber]; break;
    case 'ExcludeLine': tuple = ['EX', d.issueId, d.lineNumber, d.reason]; break;
    default: tuple = ['??'];
  }
  return JSON.stringify(tuple);
}

// Serialização canônica da ENTRADA (NÃO do diff): estável entre retries mesmo
// que o estado atual mude após a primeira publicação. O `requestHash` é o
// SHA-256 desta string (via porta injetada) — nunca a string completa.
function canonicalRequestPayload(input: PublishPricingTableInput): string {
  const decisions = input.decisions.map(canonicalDecision).sort();
  return JSON.stringify([
    'pricing-publish-request/v1',
    input.uid,
    input.rawText,
    decisions,
    input.expectedActiveVersionId,
    input.expectedRevision,
  ]);
}

export async function publishPricingTable(
  deps: PublishPricingTableDeps,
  input: PublishPricingTableInput,
): Promise<PublishPricingTableResult> {
  // 1) validar entrada (uid confiável, mas defensivo).
  if (typeof input.uid !== 'string' || input.uid.trim().length === 0) return { state: 'invalid_input', code: 'INVALID_INPUT', message: MSG.invalid, detail: 'uid' };
  if (!IDEMPOTENCY_KEY.test(input.idempotencyKey)) return { state: 'invalid_input', code: 'INVALID_INPUT', message: MSG.invalid, detail: 'idempotency_key' };
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return { state: 'invalid_input', code: 'INVALID_INPUT', message: MSG.invalid, detail: 'expected_revision' };
  if (!isValidPointer(input.expectedActiveVersionId)) return { state: 'invalid_input', code: 'INVALID_INPUT', message: MSG.invalid, detail: 'expected_active_version_id' };
  if (typeof input.rawText !== 'string' || !Array.isArray(input.decisions)) return { state: 'invalid_input', code: 'INVALID_INPUT', message: MSG.invalid, detail: 'payload' };

  // 2) carregar a tabela ativa por uid (leitura consistente).
  let read;
  try {
    read = await deps.reader.loadActiveTable(input.uid);
  } catch {
    return { state: 'read_error', message: MSG.read };
  }
  if (!read.ok) return { state: 'read_error', message: MSG.read };
  const snapshot = read.value;

  // 3) REPROCESSAR no servidor (ignora qualquer proposta/diff do cliente).
  const parse = parsePricingTablePaste(input.rawText);
  if (!parse.ok) return { state: 'invalid_input', code: 'PARSER_FATAL', message: MSG.parser, detail: parse.fatal.code };
  const keyResult = buildPricingAnalysisKey(input.rawText, parse);
  if (!keyResult.ok) return { state: 'invalid_input', code: 'PARSER_FATAL', message: MSG.parser };

  const resolved = resolvePricingProposal({ rawText: input.rawText, expectedAnalysisKey: keyResult.key, decisions: input.decisions });
  if (!resolved.ok) {
    if (resolved.state === 'invalid_input') return { state: 'invalid_input', code: 'PARSER_FATAL', message: MSG.parser, detail: resolved.fatalCode };
    if (resolved.state === 'needs_reanalysis') return { state: 'needs_reanalysis', message: MSG.needs, blocking: resolved.blocking };
    return { state: 'resolution_invalid', code: resolved.code, message: MSG.resolution, ...(resolved.detail === undefined ? {} : { detail: resolved.detail }) };
  }

  const diff: ResolvedPricingDiffResult = diffResolvedPricingTable({ currentAreas: snapshot.areas, proposal: resolved.proposal });
  if (!diff.ok) return { state: 'analysis_error', message: MSG.analysis, detail: diff.code };
  if (diff.canPublish !== true || diff.conflicts.length > 0) return { state: 'review_required', reason: 'diff_conflicts', message: MSG.review };

  // 4) montar o plano: reusar areaId (changed/unchanged); IDs novos DETERMINÍSTICOS.
  const items: PublishAreaPlan[] = [];
  for (const c of diff.changed) items.push({ areaId: c.areaId, displayName: c.proposed.displayName, nameNormalized: c.proposed.nameNormalized, aliases: [...c.aliasesResult], amountCents: c.proposed.amountCents });
  for (const u of diff.unchanged) items.push({ areaId: u.areaId, displayName: u.proposed.displayName, nameNormalized: u.proposed.nameNormalized, aliases: [...u.current.aliases], amountCents: u.proposed.amountCents });
  for (const n of diff.newItems) {
    const areaId = deps.ids.newAreaId(`${input.idempotencyKey}::${n.proposed.nameNormalized}`);
    items.push({ areaId, displayName: n.proposed.displayName, nameNormalized: n.proposed.nameNormalized, aliases: [...n.proposed.aliases], amountCents: n.proposed.amountCents });
  }
  items.sort((a, b) => (a.nameNormalized < b.nameNormalized ? -1 : a.nameNormalized > b.nameNormalized ? 1 : 0));
  const plan: PublishPlan = { uid: input.uid, source: 'paste', items, previousVersionId: snapshot.activeVersionId };

  // 5) requestHash = SHA-256 da serialização canônica da ENTRADA (porta injetada).
  const requestHash = deps.hasher.hashCanonical(canonicalRequestPayload(input));

  // 6) commit atômico: idempotência ANTES da concorrência.
  let result;
  try {
    result = await deps.transaction.commit({
      uid: input.uid,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      expectedActiveVersionId: input.expectedActiveVersionId,
      expectedRevision: input.expectedRevision,
      plan,
    });
  } catch {
    return { state: 'error', code: 'REJECTED', message: MSG.rejected };
  }

  if (result.ok) {
    if (result.durable !== true) return { state: 'error', code: 'REJECTED', message: MSG.rejected };
    return { state: 'published', message: MSG.published, versionId: result.versionId, revision: result.revision, activationId: result.activationId, idempotentReplay: result.idempotentReplay };
  }
  if (result.code === 'CONCURRENT_MODIFICATION') return { state: 'conflict', code: 'CONCURRENT_MODIFICATION', message: MSG.conflict };
  if (result.code === 'OFFLINE') return { state: 'offline', message: MSG.offline };
  return { state: 'error', code: result.code, message: MSG.rejected };
}
