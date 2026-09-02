/**
 * Caso de uso: PUBLICAR a tabela resolvida (DEC-020.3B-2C) — application.
 *
 * Orquestra a publicação por uma PORTA de comando (interface), com
 * `expectedActiveVersionId`, `expectedRevision`, `idempotencyKey`/`requestHash`
 * e CONFIRMAÇÃO DURÁVEL: `published` só após ack durável do gateway. Pré-valida
 * o payload no cliente (defensivo — NÃO é fronteira de segurança; o servidor
 * revalida), monta os itens a partir do diff resolvido (reusa `areaId`, nunca
 * inventa id) e traduz o resultado do gateway em estados discriminados. Direção
 * application → domain. Sem Firebase/DOM/relógio/aleatório. Nada é mutado.
 */

import type { ResolvedPricingDiffResult } from '../../domain';
import type {
  PricingPublishGateway,
  PublishPricingItem,
  PublishPricingRequest,
} from '../ports/pricing-publish-gateway';

export type PublishResolvedPricingResult =
  | { readonly state: 'invalid_payload'; readonly code: 'INVALID_PUBLISH_INPUT'; readonly message: string; readonly detail: string }
  | {
      readonly state: 'published';
      readonly message: string;
      readonly versionId: string;
      readonly revision: number;
      readonly activationId: string;
      readonly idempotentReplay: boolean;
    }
  | { readonly state: 'conflict'; readonly code: 'CONCURRENT_MODIFICATION'; readonly message: string }
  | { readonly state: 'error'; readonly code: 'REJECTED' | 'REQUEST_HASH_MISMATCH'; readonly message: string }
  | { readonly state: 'offline'; readonly message: string };

export interface PublishResolvedPricingInput {
  readonly diff: ResolvedPricingDiffResult;
  readonly expectedActiveVersionId: string | null;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

const MSG = {
  invalid: 'Não é possível publicar: dados de publicação inválidos.',
  published: 'Publicação confirmada.',
  conflict: 'A tabela ativa mudou; recarregue e revise novamente.',
  rejected: 'A publicação foi rejeitada.',
  offline: 'A publicação não chegou ao servidor.',
} as const;

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;
const REQUEST_HASH = /^[A-Za-z0-9_-]{8,256}$/;

function invalid(detail: string): PublishResolvedPricingResult {
  return { state: 'invalid_payload', code: 'INVALID_PUBLISH_INPUT', message: MSG.invalid, detail };
}

function isValidPointer(v: unknown): boolean {
  return v === null || (typeof v === 'string' && v.trim().length > 0 && !v.includes('/'));
}

// Monta os itens a publicar a partir do diff LIMPO (sem conflitos). changed usa
// os aliases resultantes (união); unchanged mantém a metadata atual; novos vão
// com areaId null (o servidor atribui o id — nunca o cliente).
function buildItems(diff: Extract<ResolvedPricingDiffResult, { ok: true }>): PublishPricingItem[] {
  const items: PublishPricingItem[] = [];
  for (const c of diff.changed) {
    items.push({ areaId: c.areaId, displayName: c.proposed.displayName, nameNormalized: c.proposed.nameNormalized, aliases: [...c.aliasesResult], amountCents: c.proposed.amountCents });
  }
  for (const u of diff.unchanged) {
    items.push({ areaId: u.areaId, displayName: u.proposed.displayName, nameNormalized: u.proposed.nameNormalized, aliases: [...u.current.aliases], amountCents: u.proposed.amountCents });
  }
  for (const n of diff.newItems) {
    items.push({ areaId: null, displayName: n.proposed.displayName, nameNormalized: n.proposed.nameNormalized, aliases: [...n.proposed.aliases], amountCents: n.proposed.amountCents });
  }
  items.sort((a, b) => (a.nameNormalized < b.nameNormalized ? -1 : a.nameNormalized > b.nameNormalized ? 1 : 0));
  return items;
}

export async function publishResolvedPricingTable(
  gateway: PricingPublishGateway,
  input: PublishResolvedPricingInput,
): Promise<PublishResolvedPricingResult> {
  // 1) pré-validação (defensiva; nunca chama o gateway se reprovar).
  const diff = input.diff;
  if (!diff.ok) return invalid('diff_error');
  if (diff.canPublish !== true || diff.conflicts.length > 0) return invalid('diff_has_conflicts');
  if (!IDEMPOTENCY_KEY.test(input.idempotencyKey)) return invalid('idempotency_key');
  if (!REQUEST_HASH.test(input.requestHash)) return invalid('request_hash');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return invalid('expected_revision');
  if (!isValidPointer(input.expectedActiveVersionId)) return invalid('expected_active_version_id');

  const request: PublishPricingRequest = {
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    expectedActiveVersionId: input.expectedActiveVersionId,
    expectedRevision: input.expectedRevision,
    items: buildItems(diff),
    excludedLines: [...diff.excludedLines],
  };

  // 2) chamar o gateway; exceção = falha (não confirmada).
  let result;
  try {
    result = await gateway.publish(request);
  } catch {
    return { state: 'error', code: 'REJECTED', message: MSG.rejected };
  }

  // 3) traduzir; `published` SÓ com ack durável.
  if (result.ok) {
    if (result.durable !== true) return { state: 'error', code: 'REJECTED', message: MSG.rejected };
    return {
      state: 'published',
      message: MSG.published,
      versionId: result.versionId,
      revision: result.revision,
      activationId: result.activationId,
      idempotentReplay: result.idempotentReplay,
    };
  }
  if (result.code === 'CONCURRENT_MODIFICATION') return { state: 'conflict', code: 'CONCURRENT_MODIFICATION', message: MSG.conflict };
  if (result.code === 'OFFLINE') return { state: 'offline', message: MSG.offline };
  return { state: 'error', code: result.code, message: MSG.rejected };
}
