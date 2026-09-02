/**
 * Fakes do slice de publicação (DEC-019.2) — SÓ para testes; não exportados pelo
 * barrel de produção. Puros: sem relógio, temporizadores, aleatoriedade ou
 * ambiente. IDs de versão/ativação derivados de contador determinístico.
 */

import type { PricingArea } from '../../../../src/features/pricing/domain';
import type {
  ActiveTableReadResult,
  CommitPublishRequest,
  CommitPublishResult,
  PricingActiveTableReader,
  PricingIdGenerator,
  PricingPublishTransaction,
  ServerActiveTableSnapshot,
} from '../ports';

// ---- reader ----

export class FakeActiveTableReader implements PricingActiveTableReader {
  private calls = 0;
  private constructor(private readonly config: { kind: 'ok'; snapshot: ServerActiveTableSnapshot } | { kind: 'failed' } | { kind: 'throw' }) {}

  static withSnapshot(snapshot: ServerActiveTableSnapshot): FakeActiveTableReader {
    return new FakeActiveTableReader({ kind: 'ok', snapshot });
  }
  static empty(): FakeActiveTableReader {
    return new FakeActiveTableReader({ kind: 'ok', snapshot: { activeVersionId: null, revision: 0, areas: [] } });
  }
  static failed(): FakeActiveTableReader {
    return new FakeActiveTableReader({ kind: 'failed' });
  }
  static throwing(): FakeActiveTableReader {
    return new FakeActiveTableReader({ kind: 'throw' });
  }
  get loadCalls(): number {
    return this.calls;
  }

  loadActiveTable(): Promise<ActiveTableReadResult> {
    this.calls += 1;
    if (this.config.kind === 'throw') return Promise.reject(new Error('leitura indisponível'));
    if (this.config.kind === 'failed') return Promise.resolve({ ok: false, code: 'READ_FAILED', message: 'falhou' });
    const s = this.config.snapshot;
    return Promise.resolve({ ok: true, value: { activeVersionId: s.activeVersionId, revision: s.revision, areas: [...s.areas] } });
  }
}

// ---- gerador de IDs (determinístico por semente) ----

export class FakeIdGenerator implements PricingIdGenerator {
  private count = 0;
  get calls(): number {
    return this.count;
  }
  newAreaId(seed: string): string {
    this.count += 1;
    const safe = ('area_' + seed).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
    return safe.length > 0 ? safe : 'area_0';
  }
}

// ---- transação (idempotência ANTES da concorrência; atômica) ----

interface StoredOk {
  readonly requestHash: string;
  readonly versionId: string;
  readonly revision: number;
  readonly activationId: string;
}

export class FakePublishTransaction implements PricingPublishTransaction {
  private activeVersionId: string | null;
  private revision: number;
  private versionCount = 0;
  private publishCount = 0;
  private readonly store = new Map<string, StoredOk>();
  private readonly versions = new Map<string, readonly PricingArea['id'][]>();

  private constructor(
    initial: { activeVersionId: string | null; revision: number },
    private readonly mode: 'ok' | 'reject' | 'offline',
  ) {
    this.activeVersionId = initial.activeVersionId;
    this.revision = initial.revision;
  }

  static ok(initial: { activeVersionId: string | null; revision: number } = { activeVersionId: null, revision: 0 }): FakePublishTransaction {
    return new FakePublishTransaction(initial, 'ok');
  }
  static rejecting(initial: { activeVersionId: string | null; revision: number } = { activeVersionId: null, revision: 0 }): FakePublishTransaction {
    return new FakePublishTransaction(initial, 'reject');
  }
  static offline(initial: { activeVersionId: string | null; revision: number } = { activeVersionId: null, revision: 0 }): FakePublishTransaction {
    return new FakePublishTransaction(initial, 'offline');
  }

  /** Publicações EFETIVAS (novas versões criadas). */
  get publishes(): number {
    return this.publishCount;
  }
  get state(): { activeVersionId: string | null; revision: number; versions: number } {
    return { activeVersionId: this.activeVersionId, revision: this.revision, versions: this.versions.size };
  }
  /** IDs de área gravados na versão informada (para checar não-duplicação). */
  areaIdsOf(versionId: string): readonly string[] {
    return this.versions.get(versionId) ?? [];
  }
  /** requestHash durável armazenado para a chave (para checar que é digest, não JSON). */
  storedRequestHash(idempotencyKey: string): string | null {
    return this.store.get(idempotencyKey)?.requestHash ?? null;
  }

  commit(request: CommitPublishRequest): Promise<CommitPublishResult> {
    // 1) IDEMPOTÊNCIA primeiro — antes de qualquer checagem de concorrência.
    const prev = this.store.get(request.idempotencyKey);
    if (prev) {
      if (prev.requestHash !== request.requestHash) {
        return Promise.resolve({ ok: false, code: 'REQUEST_HASH_MISMATCH', message: 'hash diferente para a mesma chave' });
      }
      return Promise.resolve({ ok: true, durable: true, versionId: prev.versionId, revision: prev.revision, activationId: prev.activationId, idempotentReplay: true });
    }

    // 2) modos de falha (antes de mutar — mantém atomicidade).
    if (this.mode === 'offline') return Promise.resolve({ ok: false, code: 'OFFLINE', message: 'sem servidor' });
    if (this.mode === 'reject') return Promise.resolve({ ok: false, code: 'REJECTED', message: 'rejeitado' });

    // 3) CONCORRÊNCIA.
    if (request.expectedActiveVersionId !== this.activeVersionId || request.expectedRevision !== this.revision) {
      return Promise.resolve({ ok: false, code: 'CONCURRENT_MODIFICATION', message: 'ponteiro/revisão mudou' });
    }

    // 4) commit ATÔMICO (tudo-ou-nada; aqui, síncrono e completo).
    this.versionCount += 1;
    this.publishCount += 1;
    const versionId = 'ver-' + this.versionCount;
    const activationId = 'act-' + this.versionCount;
    const revision = this.revision + 1;
    this.versions.set(versionId, request.plan.items.map((i) => i.areaId));
    this.activeVersionId = versionId;
    this.revision = revision;
    this.store.set(request.idempotencyKey, { requestHash: request.requestHash, versionId, revision, activationId });
    return Promise.resolve({ ok: true, durable: true, versionId, revision, activationId, idempotentReplay: false });
  }
}
