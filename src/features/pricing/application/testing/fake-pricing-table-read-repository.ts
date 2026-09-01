/**
 * Repositório de leitura FAKE — exclusivamente para testes. NÃO é exportado pelo
 * barrel público de produção. Puro: sem relógio, temporizadores, aleatoriedade
 * ou acesso ao ambiente. Somente leitura.
 */

import type {
  PricingTableReadRepository,
  PricingTableReadResult,
  ActivePricingTableSnapshot,
} from '../ports/pricing-table-read-repository';

type FakeConfig =
  | { readonly kind: 'ok'; readonly snapshot: ActivePricingTableSnapshot }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'reject'; readonly error: unknown };

export class FakePricingTableReadRepository implements PricingTableReadRepository {
  private calls = 0;

  private constructor(private readonly config: FakeConfig) {}

  static withSnapshot(snapshot: ActivePricingTableSnapshot): FakePricingTableReadRepository {
    return new FakePricingTableReadRepository({ kind: 'ok', snapshot });
  }
  static withReadFailed(message = 'read failed'): FakePricingTableReadRepository {
    return new FakePricingTableReadRepository({ kind: 'failed', message });
  }
  static withRejection(error: unknown): FakePricingTableReadRepository {
    return new FakePricingTableReadRepository({ kind: 'reject', error });
  }

  /** Quantas vezes loadActivePricingTable foi chamado. */
  get loadCalls(): number {
    return this.calls;
  }

  loadActivePricingTable(): Promise<PricingTableReadResult> {
    this.calls += 1;
    if (this.config.kind === 'reject') return Promise.reject(this.config.error);
    if (this.config.kind === 'failed') {
      return Promise.resolve({ ok: false, code: 'READ_FAILED', message: this.config.message });
    }
    // Devolve CÓPIA do array de áreas (impede mutação acidental do fixture).
    const value: ActivePricingTableSnapshot = {
      activeVersionId: this.config.snapshot.activeVersionId,
      revision: this.config.snapshot.revision,
      areas: [...this.config.snapshot.areas],
    };
    return Promise.resolve({ ok: true, value });
  }
}
