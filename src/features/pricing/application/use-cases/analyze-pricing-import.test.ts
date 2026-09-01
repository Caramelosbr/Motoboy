import { describe, it, expect } from 'vitest';
import { toCents } from '../../../../shared/currency';
import { createPricingArea, type PricingArea } from '../../domain';
import { analyzePricingImport } from '../index';
import type { ActivePricingTableSnapshot } from '../index';
import { FakePricingTableReadRepository } from '../testing/fake-pricing-table-read-repository';

function area(id: string, displayName: string, cents: number, aliases: string[] = []): PricingArea {
  const r = createPricingArea({ id, displayName, aliases, amountCents: toCents(cents) });
  if (!r.ok) throw new Error('fixture inválida: ' + r.code);
  return r.value;
}
function snap(over: Partial<ActivePricingTableSnapshot> = {}): ActivePricingTableSnapshot {
  return { activeVersionId: 'v1', revision: 0, areas: [], ...over };
}

describe('leitura da tabela ativa', () => {
  it('1) READ_FAILED -> read_error', async () => {
    const repo = FakePricingTableReadRepository.withReadFailed();
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).toBe('read_error');
  });
  it('2) Promise rejeitada -> read_error controlado (sem exceção vazando)', async () => {
    const repo = FakePricingTableReadRepository.withRejection(new Error('boom'));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).toBe('read_error');
  });
  it('16) load chamado exatamente uma vez', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap());
    await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(repo.loadCalls).toBe(1);
  });
});

describe('validação do snapshot -> invalid_snapshot', () => {
  const casos: ReadonlyArray<readonly [string, ActivePricingTableSnapshot]> = [
    ['revision negativa', snap({ revision: -1 })],
    ['revision float', snap({ revision: 1.5 })],
    ['revision NaN', snap({ revision: Number.NaN })],
    ['revision Infinity', snap({ revision: Number.POSITIVE_INFINITY })],
    ['activeVersionId vazio', snap({ activeVersionId: '' })],
    ['activeVersionId com "/"', snap({ activeVersionId: 'a/b' })],
    ['null com áreas', snap({ activeVersionId: null, areas: [area('a1', 'Centro', 1000)] })],
    ['id duplicado', snap({ areas: [area('a1', 'Centro', 1000), area('a1', 'Norte', 1000)] })],
  ];
  for (const [nome, s] of casos) {
    it(`${nome}`, async () => {
      const repo = FakePricingTableReadRepository.withSnapshot(s);
      const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
      expect(r.state).toBe('invalid_snapshot');
      if (r.state === 'invalid_snapshot') expect(r.code).toBe('INVALID_ACTIVE_SNAPSHOT');
    });
  }
  it('6) mais de MAX_PRICING_AREAS', async () => {
    const areas = Array.from({ length: 301 }, (_v, i) => area('a' + i, 'Bairro ' + i, 1000));
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ areas }));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).toBe('invalid_snapshot');
  });
  it('8) PricingArea inválida', async () => {
    const bad = { id: 'a1', displayName: 'X', nameNormalized: 'outro', aliases: [], amountCents: toCents(1000) } as PricingArea;
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ areas: [bad] }));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).toBe('invalid_snapshot');
  });
  it('snapshot inválido é detectado mesmo com importação bloqueada', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ revision: -1 }));
    const r = await analyzePricingImport(repo, ''); // texto vazio (fatal), mas snapshot vem antes
    expect(r.state).toBe('invalid_snapshot');
  });

  it('activeVersionId só com espaços "   " -> invalid_snapshot', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ activeVersionId: '   ' }));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).toBe('invalid_snapshot');
  });

  it('activeVersionId só com tab/quebra "\\t\\n" -> invalid_snapshot', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ activeVersionId: '\t\n' }));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).toBe('invalid_snapshot');
  });

  it('activeVersionId "version-1" -> válido (não é invalid_snapshot)', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ activeVersionId: 'version-1' }));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(r.state).not.toBe('invalid_snapshot');
    expect(r.state).toBe('ready');
  });

  it('snapshot com activeVersionId com espaços permanece sem mutação', async () => {
    const s = snap({ activeVersionId: '  v x  ' });
    const antes = JSON.stringify(s);
    const repo = FakePricingTableReadRepository.withSnapshot(s);
    await analyzePricingImport(repo, 'R$10,00\nCentro');
    expect(JSON.stringify(s)).toBe(antes); // trim não alterou o snapshot recebido
    expect(s.activeVersionId).toBe('  v x  ');
  });
});

describe('parser -> invalid_input / review_required', () => {
  it('9) texto vazio -> invalid_input EMPTY_INPUT, sem diff', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap());
    const r = await analyzePricingImport(repo, '   ');
    expect(r.state).toBe('invalid_input');
    if (r.state === 'invalid_input') expect(r.fatalCode).toBe('EMPTY_INPUT');
    expect('diff' in (r as object)).toBe(false);
  });
  it('10) AMBIGUOUS_GROUPING -> review_required (parser_issues), sem diff', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap());
    const r = await analyzePricingImport(repo, 'R$10,00\nNilson Veloso I e II');
    expect(r.state).toBe('review_required');
    if (r.state === 'review_required') {
      expect(r.reason).toBe('parser_issues');
      expect(r.parse.issues.map((i) => i.code)).toContain('AMBIGUOUS_GROUPING');
      expect('diff' in (r as object)).toBe(false);
    }
  });
  it('11) lista real de 51 itens -> review_required, 51 preservados, linhas/issues preservadas, sem diff', async () => {
    const L: string[] = ['R$12,00:', '• Condomínio Flamboyant I e II'];
    for (let i = 1; i <= 16; i += 1) L.push('• Setor Doze ' + String(i).padStart(2, '0'));
    L.push('R$15,00:', '• Milhão (antiga Kowalski)');
    for (let i = 1; i <= 10; i += 1) L.push('* Setor Quinze ' + String(i).padStart(2, '0'));
    L.push('R$20,00:', '* santa clara', '- Kowalski', '• Nilson Veloso I e II');
    for (let i = 1; i <= 17; i += 1) L.push('- Setor Vinte ' + String(i).padStart(2, '0'));
    L.push('R$25,00:', '• Décio 060', '• Zona 2501', '• Zona 2502');
    const repo = FakePricingTableReadRepository.withSnapshot(snap());
    const r = await analyzePricingImport(repo, L.join('\n'));
    expect(r.state).toBe('review_required');
    if (r.state === 'review_required') {
      expect(r.reason).toBe('parser_issues');
      expect(r.parse.items.length).toBe(51);
      expect(r.parse.issues.some((i) => i.code === 'ALIAS_CONFLICT_IN_PASTE' && Array.isArray(i.lineNumbers))).toBe(true);
      expect('diff' in (r as object)).toBe(false);
    }
  });
});

describe('parse limpo -> diff -> ready / conflitos / erro', () => {
  it('12) parser limpo + tabela vazia -> ready, todos new', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap());
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro\nNorte');
    expect(r.state).toBe('ready');
    if (r.state === 'ready') expect(r.diff.counts).toMatchObject({ new: 2, changed: 0, removed: 0, unchanged: 0, conflicts: 0 });
  });
  it('13) parser limpo + unchanged/changed/removed -> ready com categorias', async () => {
    const areas = [area('a1', 'Centro', 1000), area('a2', 'Sul', 1000), area('a3', 'Leste', 1000)];
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ areas }));
    const r = await analyzePricingImport(repo, 'R$10,00\nCentro\nNorte\nR$15,00\nLeste');
    expect(r.state).toBe('ready');
    if (r.state === 'ready') {
      expect(r.diff.unchanged.map((u) => u.areaId)).toEqual(['a1']);
      expect(r.diff.changed.map((c) => c.areaId)).toEqual(['a3']);
      expect(r.diff.newItems.map((n) => n.proposed.nameNormalized)).toEqual(['norte']);
      expect(r.diff.removed.map((x) => x.area.id)).toEqual(['a2']);
    }
  });
  it('14) parser limpo + conflito nome/alias -> review_required com diff e conflicts', async () => {
    const areas = [area('a-kow', 'Kowalski', 2000), area('a-mil', 'Milhão', 1500, ['kowalski'])];
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ areas }));
    const r = await analyzePricingImport(repo, 'R$20,00\nKowalski');
    expect(r.state).toBe('review_required');
    if (r.state === 'review_required') {
      expect(r.reason).toBe('diff_conflicts');
      if (r.reason === 'diff_conflicts') {
        expect(r.diff.conflicts[0].candidates.map((c) => c.id)).toEqual(['a-kow', 'a-mil']);
      }
    }
  });
});

describe('imutabilidade, determinismo, fake e ausência de escrita', () => {
  it('17/13b) inputs/snapshot/arrays/entidades não mutados', async () => {
    const areas = [area('a1', 'Centro', 1000)];
    const s = snap({ areas });
    const snapshotSnap = JSON.stringify(s);
    const repo = FakePricingTableReadRepository.withSnapshot(s);
    await analyzePricingImport(repo, 'R$15,00\nCentro\nNorte');
    expect(JSON.stringify(s)).toBe(snapshotSnap);
    expect(areas.map((a) => a.id)).toEqual(['a1']);
  });
  it('18) determinístico', async () => {
    const areas = [area('a1', 'Centro', 1000)];
    const r1 = await analyzePricingImport(FakePricingTableReadRepository.withSnapshot(snap({ areas })), 'R$10,00\nCentro\nNorte');
    const r2 = await analyzePricingImport(FakePricingTableReadRepository.withSnapshot(snap({ areas })), 'R$10,00\nCentro\nNorte');
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
  it('19) fake devolve cópia do array', async () => {
    const areas = [area('a1', 'Centro', 1000)];
    const repo = FakePricingTableReadRepository.withSnapshot(snap({ areas }));
    const read = await repo.loadActivePricingTable();
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.areas).not.toBe(areas); // array copiado
  });
  it('20) porta/repositório não possui operação de escrita', async () => {
    const repo = FakePricingTableReadRepository.withSnapshot(snap());
    const anyRepo = repo as unknown as Record<string, unknown>;
    for (const m of ['save', 'write', 'update', 'delete', 'publish', 'reactivate']) {
      expect(typeof anyRepo[m]).toBe('undefined');
    }
  });
});
