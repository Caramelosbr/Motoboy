/**
 * Porta de COMANDO de publicação da Tabela de deslocamento (DEC-020.3B-2C) —
 * contrato neutro, sem Firebase/Functions/DOM. A application depende desta
 * interface; a implementação autoritativa (callable no servidor) vem em etapa
 * própria. O cliente NÃO é fronteira de segurança: a validação real é refeita
 * no servidor. Falhas viram Result discriminado (o gateway não lança negócio).
 *
 * Direção: application → domain. O domínio nunca importa isto.
 */

import type { Cents } from '../../../../shared/currency';
import type { ExcludedPricingLine } from '../../domain';

/** Item a publicar: `areaId` reusado (changed/unchanged) ou `null` (novo). NUNCA gerado no cliente. */
export interface PublishPricingItem {
  readonly areaId: string | null;
  readonly displayName: string;
  readonly nameNormalized: string;
  readonly aliases: readonly string[];
  readonly amountCents: Cents;
}

export interface PublishPricingRequest {
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly expectedActiveVersionId: string | null;
  readonly expectedRevision: number;
  readonly items: readonly PublishPricingItem[];
  readonly excludedLines: readonly ExcludedPricingLine[];
}

export type PublishGatewayResult =
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

export interface PricingPublishGateway {
  publish(request: PublishPricingRequest): Promise<PublishGatewayResult>;
}
