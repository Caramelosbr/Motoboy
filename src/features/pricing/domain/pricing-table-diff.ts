/**
 * Diff PURO entre a tabela ativa (currentAreas) e a proposta importada.
 *
 * Contrato reforçado (DEC-020): recebe o RESULTADO COMPLETO do parser
 * (`PricingPasteParseResult`), não apenas os itens. Assim o próprio domínio
 * impede que um chamador descarte pendências e publique uma proposta com
 * issues/unparsed/fatal. Só um parse limpo chega ao matching e às categorias.
 *
 * Apenas DESCREVE a mudança — não aplica, não gera versão, não cria areaId,
 * não renomeia, não cria alias, não muta nada. Matching exato via matchPricingArea.
 */

import type { PricingArea } from './pricing-area';
import { validatePricingArea, MAX_PRICING_AREAS } from './pricing-area';
import { matchPricingArea, type PricingMatchBy } from './match-pricing-area';
import type {
  ParsedPricingItem,
  ParsedUnparsedLine,
  PricingPasteFatalCode,
  PricingPasteIssue,
  PricingPasteParseResult,
} from './paste-parser';

export type PricingDiffErrorCode =
  | 'INVALID_PROPOSAL'
  | 'PROPOSAL_HAS_BLOCKING_ISSUES'
  | 'INVALID_CURRENT_TABLE'
  | 'DUPLICATE_CURRENT_ID'
  | 'PROPOSAL_HAS_DUPLICATES'
  | 'PROPOSAL_ITEM_WITHOUT_PRICE';

export interface PricingDiffNew {
  readonly proposed: ParsedPricingItem; // item novo — NUNCA recebe id aqui
}
export interface PricingDiffChanged {
  readonly areaId: string; // id reaproveitado (identidade estável)
  readonly current: PricingArea;
  readonly proposed: ParsedPricingItem;
  readonly matchedBy: PricingMatchBy;
}
export interface PricingDiffUnchanged {
  readonly areaId: string;
  readonly current: PricingArea;
  readonly proposed: ParsedPricingItem;
  readonly matchedBy: PricingMatchBy;
}
export interface PricingDiffRemoved {
  readonly area: PricingArea;
}
export interface PricingDiffConflict {
  readonly proposed: ParsedPricingItem;
  readonly candidates: readonly PricingArea[];
}

export interface PricingTableDiffCounts {
  readonly new: number;
  readonly changed: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly conflicts: number;
}

export interface PricingTableDiffError {
  readonly ok: false;
  readonly code: PricingDiffErrorCode;
  readonly message: string;
  readonly detail?: string;
  readonly fatalCode?: PricingPasteFatalCode;
  readonly issues?: readonly PricingPasteIssue[];
  readonly unparsed?: readonly ParsedUnparsedLine[];
}

export interface PricingTableDiffOk {
  readonly ok: true;
  readonly newItems: readonly PricingDiffNew[];
  readonly changed: readonly PricingDiffChanged[];
  readonly removed: readonly PricingDiffRemoved[];
  readonly unchanged: readonly PricingDiffUnchanged[];
  readonly conflicts: readonly PricingDiffConflict[];
  readonly counts: PricingTableDiffCounts;
  readonly canPublish: boolean;
}

export type PricingTableDiffResult = PricingTableDiffError | PricingTableDiffOk;

function isPositiveCents(n: unknown): boolean {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}

function byNameThenLine(a: ParsedPricingItem, b: ParsedPricingItem): number {
  if (a.nameNormalized !== b.nameNormalized) return a.nameNormalized < b.nameNormalized ? -1 : 1;
  return a.lineNumber - b.lineNumber;
}

export function diffPricingTable(
  currentAreas: readonly PricingArea[],
  proposal: PricingPasteParseResult,
): PricingTableDiffResult {
  // A) o parse não pode ser fatal — sem diff parcial.
  if (!proposal.ok) {
    return {
      ok: false,
      code: 'INVALID_PROPOSAL',
      message: 'Proposta inválida: o parse terminou com falha fatal.',
      fatalCode: proposal.fatal.code,
    };
  }

  // B) só um parse LIMPO segue. Não confia só no booleano: exige issues e
  //    unparsed vazios E canPublish === true (bloqueia qualquer inconsistência).
  const blocked =
    proposal.issues.length > 0 || proposal.unparsed.length > 0 || proposal.canPublish !== true;
  if (blocked) {
    return {
      ok: false,
      code: 'PROPOSAL_HAS_BLOCKING_ISSUES',
      message: 'Proposta possui pendências que impedem a publicação.',
      issues: proposal.issues,
      unparsed: proposal.unparsed,
    };
  }

  const proposedItems = proposal.items;

  // C) tabela atual válida e sem ids duplicados.
  const seenId = new Set<string>();
  for (const area of currentAreas) {
    const v = validatePricingArea(area);
    if (!v.ok) return { ok: false, code: 'INVALID_CURRENT_TABLE', message: 'Tabela atual inválida.', detail: area.id };
    if (seenId.has(area.id)) return { ok: false, code: 'DUPLICATE_CURRENT_ID', message: 'ID duplicado na tabela atual.', detail: area.id };
    seenId.add(area.id);
  }

  // D) verificação defensiva da proposta (mesmo "limpa"): não confiar cegamente
  //    em objeto construído manualmente.
  if (proposedItems.length > MAX_PRICING_AREAS) {
    return {
      ok: false,
      code: 'PROPOSAL_HAS_BLOCKING_ISSUES',
      message: `Proposta acima de ${MAX_PRICING_AREAS} áreas.`,
      issues: [{ code: 'TOO_MANY_AREAS', lineNumber: null, message: `Acima de ${MAX_PRICING_AREAS} áreas.` }],
    };
  }
  const seenNorm = new Set<string>();
  for (const item of proposedItems) {
    if (!isPositiveCents(item.amountCents)) {
      return { ok: false, code: 'PROPOSAL_ITEM_WITHOUT_PRICE', message: 'Item proposto sem preço válido.', detail: item.nameNormalized };
    }
    if (seenNorm.has(item.nameNormalized)) {
      return { ok: false, code: 'PROPOSAL_HAS_DUPLICATES', message: 'Proposta contém itens duplicados.', detail: item.nameNormalized };
    }
    seenNorm.add(item.nameNormalized);
  }

  // E) matching exato por item.
  const newItems: PricingDiffNew[] = [];
  const changed: PricingDiffChanged[] = [];
  const unchanged: PricingDiffUnchanged[] = [];
  const conflicts: PricingDiffConflict[] = [];
  const matchedIds = new Set<string>();
  const conflictCandidateIds = new Set<string>();

  for (const item of proposedItems) {
    const match = matchPricingArea(currentAreas, [item.displayName]);
    if (match.kind === 'none') {
      newItems.push({ proposed: item }); // sem id inventado
    } else if (match.kind === 'unique') {
      matchedIds.add(match.area.id);
      if ((match.area.amountCents as number) === (item.amountCents as number)) {
        unchanged.push({ areaId: match.area.id, current: match.area, proposed: item, matchedBy: match.by });
      } else {
        changed.push({ areaId: match.area.id, current: match.area, proposed: item, matchedBy: match.by });
      }
    } else {
      for (const c of match.areas) conflictCandidateIds.add(c.id);
      conflicts.push({ proposed: item, candidates: match.areas });
    }
  }

  // F) removidos: áreas atuais não casadas de forma única e fora de conflito.
  const removed: PricingDiffRemoved[] = currentAreas
    .filter((a) => !matchedIds.has(a.id) && !conflictCandidateIds.has(a.id))
    .map((area) => ({ area }));

  // G) ordenação determinística.
  newItems.sort((x, y) => byNameThenLine(x.proposed, y.proposed));
  changed.sort((x, y) => byNameThenLine(x.proposed, y.proposed));
  unchanged.sort((x, y) => byNameThenLine(x.proposed, y.proposed));
  conflicts.sort((x, y) => byNameThenLine(x.proposed, y.proposed));
  removed.sort((x, y) => (x.area.id < y.area.id ? -1 : x.area.id > y.area.id ? 1 : 0));

  const counts: PricingTableDiffCounts = {
    new: newItems.length,
    changed: changed.length,
    removed: removed.length,
    unchanged: unchanged.length,
    conflicts: conflicts.length,
  };

  return { ok: true, newItems, changed, removed, unchanged, conflicts, counts, canPublish: conflicts.length === 0 };
}
