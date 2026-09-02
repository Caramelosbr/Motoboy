/**
 * Diff RESOLVIDO (DEC-020.3B-2B) — puro: compara a proposta resolvida (3B-2A)
 * com a tabela ativa e DESCREVE a mudança para revisão humana.
 *
 * Reaproveita `areaId` por match exato (nome/alias); nunca inventa id; nunca
 * funde/renomeia sozinho; nunca remove metadata (aliases/type) em silêncio —
 * toda adição de alias é explícita. Não publica, não grava, não conhece
 * concorrência (`activeVersionId`/`revision` são comparados na publicação, fora
 * daqui). Defesa de fronteira: revalida a proposta e a tabela ativa recebidas.
 * Result discriminado; sem exceções de negócio; entradas nunca mutadas.
 */

import type { PricingArea } from './pricing-area';
import {
  validatePricingArea,
  MAX_PRICING_AREAS,
  MAX_PRICING_ALIASES,
  MAX_PRICING_ALIAS_LENGTH,
  MAX_PRICING_DISPLAY_NAME_LENGTH,
} from './pricing-area';
import { matchPricingArea, type PricingMatchBy } from './match-pricing-area';
import { normalizePricingName } from './normalize-pricing-name';
import type { ResolvedPricingItem, ResolvedPricingProposal, ExcludedPricingLine } from './resolve-pricing-proposal';

export type ResolvedPricingDiffErrorCode =
  | 'INVALID_RESOLVED_PROPOSAL'
  | 'INVALID_CURRENT_TABLE'
  | 'DUPLICATE_CURRENT_ID'
  | 'INVALID_MERGED_ALIASES';

export interface ResolvedPricingDiffNew {
  readonly proposed: ResolvedPricingItem; // NUNCA recebe id aqui
}
export interface ResolvedPricingDiffChanged {
  readonly areaId: string; // id reaproveitado (identidade estável)
  readonly current: PricingArea;
  readonly proposed: ResolvedPricingItem;
  readonly matchedBy: PricingMatchBy;
  readonly amountChanged: boolean;
  readonly displayNameChanged: boolean;
  readonly aliasesAdded: readonly string[]; // aliases novos (metadata antiga preservada)
  readonly aliasesResult: readonly string[]; // união determinística (existentes + novos)
}
export interface ResolvedPricingDiffUnchanged {
  readonly areaId: string;
  readonly current: PricingArea;
  readonly proposed: ResolvedPricingItem;
  readonly matchedBy: PricingMatchBy;
}
export interface ResolvedPricingDiffRemoved {
  readonly area: PricingArea;
}
export interface ResolvedPricingDiffConflict {
  readonly proposed: ResolvedPricingItem;
  readonly candidates: readonly PricingArea[];
}

export interface ResolvedPricingDiffCounts {
  readonly new: number;
  readonly changed: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly conflicts: number;
}

export interface ResolvedPricingDiffError {
  readonly ok: false;
  readonly code: ResolvedPricingDiffErrorCode;
  readonly message: string;
  readonly detail?: string;
}

export interface ResolvedPricingDiffOk {
  readonly ok: true;
  readonly analysisKey: string;
  readonly newItems: readonly ResolvedPricingDiffNew[];
  readonly changed: readonly ResolvedPricingDiffChanged[];
  readonly removed: readonly ResolvedPricingDiffRemoved[];
  readonly unchanged: readonly ResolvedPricingDiffUnchanged[];
  readonly conflicts: readonly ResolvedPricingDiffConflict[];
  readonly excludedLines: readonly ExcludedPricingLine[];
  readonly counts: ResolvedPricingDiffCounts;
  readonly canPublish: boolean;
}

export type ResolvedPricingDiffResult = ResolvedPricingDiffError | ResolvedPricingDiffOk;

export interface DiffResolvedPricingTableInput {
  readonly currentAreas: readonly PricingArea[];
  readonly proposal: ResolvedPricingProposal;
}

const MSG = {
  proposal: 'Proposta resolvida inválida.',
  current: 'Tabela ativa inválida.',
  dupId: 'ID duplicado na tabela ativa.',
  aliases: 'Aliases resultantes inválidos.',
} as const;

function fail(code: ResolvedPricingDiffErrorCode, message: string, detail?: string): ResolvedPricingDiffError {
  return detail === undefined ? { ok: false, code, message } : { ok: false, code, message, detail };
}

function isPositiveCents(n: unknown): boolean {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}
function isCanonicalAlias(a: unknown): a is string {
  return typeof a === 'string' && a.length > 0 && a.length <= MAX_PRICING_ALIAS_LENGTH && a === normalizePricingName(a);
}

// Defesa de fronteira: não confia no objeto recebido como proposta.
function validateResolvedProposal(p: ResolvedPricingProposal): string | null {
  if (p === null || typeof p !== 'object' || !Array.isArray(p.items)) return 'estrutura';
  if (p.items.length > MAX_PRICING_AREAS) return 'too_many';
  const names = new Set<string>();
  const aliasesGlobal = new Set<string>();
  for (const it of p.items) {
    if (!it || typeof it.displayName !== 'string' || it.displayName.trim().length === 0) return 'displayName';
    if (it.displayName.length > MAX_PRICING_DISPLAY_NAME_LENGTH) return 'displayName_len';
    if (it.nameNormalized !== normalizePricingName(it.displayName) || it.nameNormalized.length === 0) return 'nameNormalized';
    if (!isPositiveCents(it.amountCents)) return 'amount';
    if (names.has(it.nameNormalized)) return 'dup_name';
    names.add(it.nameNormalized);
    if (!Array.isArray(it.aliases) || it.aliases.length > MAX_PRICING_ALIASES) return 'aliases';
    const local = new Set<string>();
    for (const a of it.aliases) {
      if (!isCanonicalAlias(a)) return 'alias_form';
      if (a === it.nameNormalized) return 'alias_eq_name';
      if (local.has(a)) return 'alias_dup';
      local.add(a);
    }
  }
  // aliases não podem coincidir com nome de outro item nem com alias de terceiros.
  for (const it of p.items) {
    for (const a of it.aliases) {
      if (names.has(a) && a !== it.nameNormalized) return 'alias_vs_name';
      if (aliasesGlobal.has(a)) return 'alias_vs_alias';
      aliasesGlobal.add(a);
    }
  }
  return null;
}

// União determinística: existentes na ordem original + novos ainda não presentes.
function mergeAliases(existing: readonly string[], incoming: readonly string[]): { result: string[]; added: string[] } {
  const seen = new Set<string>(existing);
  const result = [...existing];
  const added: string[] = [];
  for (const a of incoming) {
    if (seen.has(a)) continue;
    seen.add(a);
    result.push(a);
    added.push(a);
  }
  return { result, added };
}

export function diffResolvedPricingTable(input: DiffResolvedPricingTableInput): ResolvedPricingDiffResult {
  const proposal = input.proposal;

  // A) proposta válida (fronteira).
  const pProblem = validateResolvedProposal(proposal);
  if (pProblem) return fail('INVALID_RESOLVED_PROPOSAL', MSG.proposal, pProblem);

  // B) tabela atual válida e sem ids duplicados.
  const seenId = new Set<string>();
  for (const area of input.currentAreas) {
    if (!validatePricingArea(area).ok) return fail('INVALID_CURRENT_TABLE', MSG.current, area?.id);
    if (seenId.has(area.id)) return fail('DUPLICATE_CURRENT_ID', MSG.dupId, area.id);
    seenId.add(area.id);
  }
  const areaById = new Map<string, PricingArea>(input.currentAreas.map((a) => [a.id, a]));

  // C) match por item (nome + aliases explícitos). Registra reivindicações por id.
  interface Claim {
    item: ResolvedPricingItem;
    areaId: string;
    by: PricingMatchBy;
  }
  const claims: Claim[] = [];
  const newItems: ResolvedPricingDiffNew[] = [];
  const conflicts: ResolvedPricingDiffConflict[] = [];
  const claimsByArea = new Map<string, Claim[]>();
  const conflictCandidateIds = new Set<string>();

  for (const item of proposal.items) {
    const candidates = [item.displayName, ...item.aliases];
    const match = matchPricingArea(input.currentAreas, candidates);
    if (match.kind === 'none') {
      newItems.push({ proposed: item });
    } else if (match.kind === 'unique') {
      const claim: Claim = { item, areaId: match.area.id, by: match.by };
      claims.push(claim);
      const arr = claimsByArea.get(match.area.id) ?? [];
      arr.push(claim);
      claimsByArea.set(match.area.id, arr);
    } else {
      for (const c of match.areas) conflictCandidateIds.add(c.id);
      conflicts.push({ proposed: item, candidates: match.areas });
    }
  }

  // D) uma área reivindicada por >1 item → conflito (nunca resolve sozinho).
  const changed: ResolvedPricingDiffChanged[] = [];
  const unchanged: ResolvedPricingDiffUnchanged[] = [];
  const matchedIds = new Set<string>();

  for (const claim of claims) {
    const group = claimsByArea.get(claim.areaId);
    if (group && group.length > 1) {
      const area = areaById.get(claim.areaId);
      if (area) conflictCandidateIds.add(area.id);
      conflicts.push({ proposed: claim.item, candidates: area ? [area] : [] });
      continue;
    }
    const area = areaById.get(claim.areaId);
    if (!area) continue; // defensivo (inalcançável: id veio do match)
    matchedIds.add(area.id);

    const amountChanged = (area.amountCents as number) !== (claim.item.amountCents as number);
    const displayNameChanged = area.displayName !== claim.item.displayName;
    const { result, added } = mergeAliases(area.aliases, claim.item.aliases);

    // metadata de alias resultante precisa continuar válida (limites/forma/nome).
    if (result.length > MAX_PRICING_ALIASES) return fail('INVALID_MERGED_ALIASES', MSG.aliases, area.id);
    for (const a of result) {
      if (!isCanonicalAlias(a) || a === claim.item.nameNormalized) return fail('INVALID_MERGED_ALIASES', MSG.aliases, area.id);
    }

    if (amountChanged || displayNameChanged || added.length > 0) {
      changed.push({
        areaId: area.id,
        current: area,
        proposed: claim.item,
        matchedBy: claim.by,
        amountChanged,
        displayNameChanged,
        aliasesAdded: added,
        aliasesResult: result,
      });
    } else {
      unchanged.push({ areaId: area.id, current: area, proposed: claim.item, matchedBy: claim.by });
    }
  }

  // E) removidos: áreas ativas não casadas de forma única e fora de conflito.
  const removed: ResolvedPricingDiffRemoved[] = input.currentAreas
    .filter((a) => !matchedIds.has(a.id) && !conflictCandidateIds.has(a.id))
    .map((area) => ({ area }));

  // F) ordenação determinística.
  const byName = (a: { proposed: ResolvedPricingItem }, b: { proposed: ResolvedPricingItem }): number =>
    a.proposed.nameNormalized < b.proposed.nameNormalized ? -1 : a.proposed.nameNormalized > b.proposed.nameNormalized ? 1 : 0;
  const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  newItems.sort(byName);
  changed.sort((x, y) => byId(x.areaId, y.areaId));
  unchanged.sort((x, y) => byId(x.areaId, y.areaId));
  conflicts.sort(byName);
  removed.sort((x, y) => byId(x.area.id, y.area.id));

  const counts: ResolvedPricingDiffCounts = {
    new: newItems.length,
    changed: changed.length,
    removed: removed.length,
    unchanged: unchanged.length,
    conflicts: conflicts.length,
  };

  return {
    ok: true,
    analysisKey: proposal.analysisKey,
    newItems,
    changed,
    removed,
    unchanged,
    conflicts,
    excludedLines: proposal.excludedLines.slice(),
    counts,
    canPublish: conflicts.length === 0,
  };
}
