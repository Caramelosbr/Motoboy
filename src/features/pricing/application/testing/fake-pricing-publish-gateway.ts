/**
 * Gateway de publicação FAKE — exclusivamente para testes. NÃO é exportado pelo
 * barrel público de produção. Puro: sem relógio, temporizadores, aleatoriedade
 * ou acesso ao ambiente. IDs derivados determinísticamente do contador.
 *
 * Guarda memória por `idempotencyKey` para provar idempotência (duplo clique =
 * uma única publicação efetiva) e conta chamadas × publicações efetivas.
 */

import type {
  PricingPublishGateway,
  PublishPricingRequest,
  PublishGatewayResult,
} from '../ports/pricing-publish-gateway';

type Mode = 'ok' | 'conflict' | 'offline' | 'rejected' | 'throw';

interface StoredOk {
  readonly requestHash: string;
  readonly versionId: string;
  readonly revision: number;
  readonly activationId: string;
}

export class FakePricingPublishGateway implements PricingPublishGateway {
  private callCount = 0;
  private publishCount = 0;
  private readonly store = new Map<string, StoredOk>();

  private constructor(private readonly mode: Mode) {}

  static ok(): FakePricingPublishGateway {
    return new FakePricingPublishGateway('ok');
  }
  static conflict(): FakePricingPublishGateway {
    return new FakePricingPublishGateway('conflict');
  }
  static offline(): FakePricingPublishGateway {
    return new FakePricingPublishGateway('offline');
  }
  static rejected(): FakePricingPublishGateway {
    return new FakePricingPublishGateway('rejected');
  }
  static throwing(): FakePricingPublishGateway {
    return new FakePricingPublishGateway('throw');
  }

  /** Quantas vezes publish() foi chamado (inclui rejeições e replays). */
  get calls(): number {
    return this.callCount;
  }
  /** Quantas publicações EFETIVAS (novas versões) ocorreram. */
  get publishes(): number {
    return this.publishCount;
  }

  publish(request: PublishPricingRequest): Promise<PublishGatewayResult> {
    this.callCount += 1;

    if (this.mode === 'throw') return Promise.reject(new Error('gateway indisponível'));
    if (this.mode === 'conflict') {
      return Promise.resolve({ ok: false, code: 'CONCURRENT_MODIFICATION', message: 'ponteiro mudou' });
    }
    if (this.mode === 'offline') {
      return Promise.resolve({ ok: false, code: 'OFFLINE', message: 'sem servidor' });
    }
    if (this.mode === 'rejected') {
      return Promise.resolve({ ok: false, code: 'REJECTED', message: 'rejeitado' });
    }

    // mode === 'ok': idempotência por idempotencyKey.
    const prev = this.store.get(request.idempotencyKey);
    if (prev) {
      if (prev.requestHash !== request.requestHash) {
        return Promise.resolve({ ok: false, code: 'REQUEST_HASH_MISMATCH', message: 'hash diferente para a mesma chave' });
      }
      return Promise.resolve({
        ok: true,
        durable: true,
        versionId: prev.versionId,
        revision: prev.revision,
        activationId: prev.activationId,
        idempotentReplay: true,
      });
    }

    this.publishCount += 1;
    const stored: StoredOk = {
      requestHash: request.requestHash,
      versionId: 'v' + this.publishCount,
      revision: request.expectedRevision + 1,
      activationId: 'act' + this.publishCount,
    };
    this.store.set(request.idempotencyKey, stored);
    return Promise.resolve({
      ok: true,
      durable: true,
      versionId: stored.versionId,
      revision: stored.revision,
      activationId: stored.activationId,
      idempotentReplay: false,
    });
  }
}
