/**
 * Ports NEUTRAS do slice server-side de publicação (DEC-019.2). Vivem em
 * `functions/src/` e importam apenas TIPOS do núcleo compartilhado da raiz
 * (`../../../src/…`). Sem firebase-admin, sem Firestore, sem callable.
 *
 * A autoridade de escrita é o servidor; o cliente não é fronteira de segurança.
 * A porta transacional executa idempotência ANTES da concorrência e é atômica
 * (tudo-ou-nada). O gerador de IDs é DETERMINÍSTICO por semente: retries com a
 * mesma entrada produzem os mesmos IDs (não duplicam versões/áreas).
 */

import type { Cents } from '../../../src/shared/currency';
import type { PricingArea } from '../../../src/features/pricing/domain';

// ---- leitura consistente da tabela ativa (por uid) ----

export interface ServerActiveTableSnapshot {
  readonly activeVersionId: string | null;
  readonly revision: number;
  readonly areas: readonly PricingArea[];
}

export type ActiveTableReadResult =
  | { readonly ok: true; readonly value: ServerActiveTableSnapshot }
  | { readonly ok: false; readonly code: 'READ_FAILED'; readonly message: string };

export interface PricingActiveTableReader {
  loadActiveTable(uid: string): Promise<ActiveTableReadResult>;
}

// ---- gerador de IDs (determinístico por semente) ----

export interface PricingIdGenerator {
  /** MESMA semente → MESMO id (idempotente entre retries). Nunca aleatório. */
  newAreaId(seed: string): string;
}

// ---- hasher do requestHash (SHA-256 da serialização canônica) ----

export interface RequestHasher {
  /** Digest hex determinístico da string canônica (o `requestHash` armazenado
   *  nunca é o JSON completo). MESMA entrada → MESMO digest. */
  hashCanonical(canonical: string): string;
}

// ---- transação de publicação (atômica; idempotência antes de concorrência) ----

export interface PublishAreaPlan {
  readonly areaId: string; // reusado (changed/unchanged) ou novo (gerador)
  readonly displayName: string;
  readonly nameNormalized: string;
  readonly aliases: readonly string[];
  readonly amountCents: Cents;
}

export interface PublishPlan {
  readonly uid: string;
  readonly source: 'paste';
  readonly items: readonly PublishAreaPlan[];
  readonly previousVersionId: string | null;
}

export interface CommitPublishRequest {
  readonly uid: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly expectedActiveVersionId: string | null;
  readonly expectedRevision: number;
  readonly plan: PublishPlan;
}

export type CommitPublishResult =
  | {
      readonly ok: true;
      readonly durable: true;
      readonly versionId: string;
      readonly revision: number;
      readonly activationId: string;
      readonly idempotentReplay: boolean;
    }
  | {
      readonly ok: false;
      readonly code: 'CONCURRENT_MODIFICATION' | 'REQUEST_HASH_MISMATCH' | 'REJECTED' | 'OFFLINE';
      readonly message: string;
    };

export interface PricingPublishTransaction {
  commit(request: CommitPublishRequest): Promise<CommitPublishResult>;
}
