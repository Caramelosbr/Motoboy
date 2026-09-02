/**
 * Aplicação das decisões humanas → PROPOSTA RESOLVIDA (DEC-020.3B-2A) — puro.
 *
 * Recebe SÓ o texto original, a chave esperada e as decisões. Reparseia o texto
 * internamente (nunca aceita um parse vindo de fora), revalida as decisões pelo
 * mesmo contrato da 3B-1 e, apenas quando `valid`, aplica as decisões, monta a
 * proposta resolvida com proveniência completa e a valida estruturalmente. NÃO
 * calcula diff, NÃO conhece a tabela ativa, NÃO gera id/versão, NÃO publica.
 *
 * Nunca aceita uma `ResolvedPricingProposal` pronta: a proposta é sempre
 * construída aqui. Result discriminado; sem exceções de negócio; nenhum estado
 * de erro carrega proposta parcial; entradas nunca são mutadas.
 */

import { type Cents } from '../../../shared/currency';
import {
  parsePricingTablePaste,
  type PricingPasteFatalCode,
  type PricingPasteParseResult,
} from './paste-parser';
import { buildPricingAnalysisKey } from './pricing-analysis-key';
import {
  buildIssueReferences,
  validatePricingImportDecisions,
  type PricingImportDecision,
  type PricingIssueReference,
  type PricingImportDecisionsErrorCode,
} from './pricing-import-decision';
import { normalizePricingName } from './normalize-pricing-name';
import {
  MAX_PRICING_AREAS,
  MAX_PRICING_ALIASES,
  MAX_PRICING_ALIAS_LENGTH,
  MAX_PRICING_DISPLAY_NAME_LENGTH,
} from './pricing-area';

// ---------- Modelo da proposta resolvida ----------

export interface ResolvedPricingItemProvenance {
  readonly sourceLineNumbers: readonly number[];
  readonly sourceIssueIds: readonly string[];
}

export interface ResolvedPricingItem {
  readonly displayName: string;
  readonly nameNormalized: string;
  readonly aliases: readonly string[];
  readonly amountCents: Cents;
  readonly provenance: ResolvedPricingItemProvenance;
}

export interface ExcludedPricingLine {
  readonly lineNumber: number;
  readonly rawLine: string;
  readonly reason: string;
  readonly issueId: string;
}

/**
 * Proposta intermediária de importação. NÃO carrega id de área, activeVersionId,
 * revision, createdAt, campos de publicação nem `canPublish`. Não representa
 * segurança nem autorização — a validação real é refeita no servidor.
 */
export interface ResolvedPricingProposal {
  readonly analysisKey: string;
  readonly items: readonly ResolvedPricingItem[];
  readonly excludedLines: readonly ExcludedPricingLine[];
  readonly appliedIssueIds: readonly string[];
}

// ---------- Result ----------

export type ResolvePricingProposalStructuralErrorCode =
  | 'TOO_MANY_RESOLVED_AREAS'
  | 'INVALID_RESOLVED_ITEM'
  | 'DUPLICATE_RESOLVED_NAME'
  | 'RESOLVED_ALIAS_CONFLICT'
  | 'CONFLICTING_DECISIONS'
  | 'UNACCOUNTED_SOURCE_LINE'
  | 'INVALID_PROVENANCE';

export type PricingProposalResolutionResult =
  | { readonly ok: false; readonly state: 'invalid_input'; readonly fatalCode: PricingPasteFatalCode; readonly message: string }
  | { readonly ok: false; readonly state: 'needs_reanalysis'; readonly blocking: readonly PricingIssueReference[]; readonly message: string }
  | {
      readonly ok: false;
      readonly state: 'resolution_invalid';
      readonly code: PricingImportDecisionsErrorCode | ResolvePricingProposalStructuralErrorCode;
      readonly message: string;
      readonly detail?: string;
    }
  | { readonly ok: true; readonly state: 'resolved'; readonly proposal: ResolvedPricingProposal };

export interface ResolvePricingProposalInput {
  readonly rawText: string;
  readonly expectedAnalysisKey: string;
  readonly decisions: readonly PricingImportDecision[];
}

const MSG = {
  input: 'O texto de importação é inválido.',
  needs: 'Há pendências que exigem editar o texto e reanalisar.',
  invalid: 'As decisões não resolvem a importação de forma consistente.',
  structural: 'A proposta resolvida é estruturalmente inválida.',
} as const;

function structuralInvalid(
  code: ResolvePricingProposalStructuralErrorCode,
  detail: string,
): PricingProposalResolutionResult {
  return { ok: false, state: 'resolution_invalid', code, message: MSG.structural, detail };
}

function isPositiveCents(n: unknown): n is Cents {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}

// Destino estrutural de uma linha de item (as demais decisões são anotações).
type LineFate =
  | { readonly kind: 'split'; readonly names: readonly string[] }
  | { readonly kind: 'survivor'; readonly candidateLines: readonly number[] }
  | { readonly kind: 'fold'; readonly survivorLine: number };

interface EmittedItem {
  displayName: string;
  nameNormalized: string;
  aliases: string[];
  amountCents: Cents;
  sourceLineNumbers: number[];
  issueIds: Set<string>;
  primaryLine: number;
  subIndex: number;
}

/**
 * Reparseia, revalida e — só com decisões válidas — aplica e monta a proposta
 * resolvida. Ordem: parse → (chave/stale/needs_reanalysis/cobertura via 3B-1) →
 * conflitos entre decisões → aplicação → contabilidade → validação estrutural.
 */
export function resolvePricingProposal(
  input: ResolvePricingProposalInput,
): PricingProposalResolutionResult {
  // 1) reparsear SEMPRE o texto original (nunca confia num parse externo).
  const parse: PricingPasteParseResult = parsePricingTablePaste(input.rawText);

  // 2) parse fatal → invalid_input.
  if (!parse.ok) {
    return { ok: false, state: 'invalid_input', fatalCode: parse.fatal.code, message: MSG.input };
  }

  // 3) chave exata a partir do texto + novo parse (para a proposta e as refs).
  const keyResult = buildPricingAnalysisKey(input.rawText, parse);
  if (!keyResult.ok) {
    // Inalcançável: parse.ok garante key.ok. Defensivo (não confia só no TS).
    return { ok: false, state: 'resolution_invalid', code: 'INVALID_ANALYSIS', message: MSG.invalid };
  }
  const key = keyResult.key;

  // 4/5/6/7/8) delega à validação da 3B-1: recomputa a chave, compara (stale),
  // prioriza needs_reanalysis e valida cobertura/compatibilidade/payload.
  const validation = validatePricingImportDecisions({
    rawText: input.rawText,
    parse,
    expectedAnalysisKey: input.expectedAnalysisKey,
    decisions: input.decisions,
  });
  if (!validation.ok) {
    if (validation.state === 'needs_reanalysis') {
      return { ok: false, state: 'needs_reanalysis', blocking: validation.blocking, message: MSG.needs };
    }
    return {
      ok: false,
      state: 'resolution_invalid',
      code: validation.code,
      message: MSG.invalid,
      ...(validation.detail === undefined ? {} : { detail: validation.detail }),
    };
  }

  // 9) valid → aplicar. A partir daqui todo issue é resolvível e coberto uma vez.
  const refs = buildIssueReferences(parse.issues, key);
  const refById = new Map<string, PricingIssueReference>();
  const issueIndexById = new Map<string, number>();
  for (const r of refs) {
    refById.set(r.issueId, r);
    issueIndexById.set(r.issueId, r.issueIndex);
  }
  const items = parse.items;
  const itemLineSet = new Set<number>(items.map((it) => it.lineNumber));

  // 9a) destinos estruturais por linha (split / consolidação / variante).
  const fate = new Map<number, LineFate>();
  const claim = (line: number, f: LineFate): PricingProposalResolutionResult | null => {
    if (fate.has(line)) return structuralInvalid('CONFLICTING_DECISIONS', `linha ${line} com destinos incompatíveis`);
    fate.set(line, f);
    return null;
  };
  for (const d of input.decisions) {
    if (d.kind === 'SplitGroupingIntoAreas') {
      const ref = refById.get(d.issueId);
      if (!ref || ref.lineNumber === null) continue;
      const c = claim(ref.lineNumber, { kind: 'split', names: d.names });
      if (c) return c;
    } else if (d.kind === 'ConsolidateDuplicate' || d.kind === 'ChooseDuplicateVariant') {
      const ref = refById.get(d.issueId);
      if (!ref) continue;
      const candidateLines = ref.lineNumbers ?? (ref.lineNumber !== null ? [ref.lineNumber] : []);
      const survivor = claim(d.keepLineNumber, { kind: 'survivor', candidateLines: [...candidateLines].sort((a, b) => a - b) });
      if (survivor) return survivor;
      for (const cl of candidateLines) {
        if (cl === d.keepLineNumber) continue;
        const folded = claim(cl, { kind: 'fold', survivorLine: d.keepLineNumber });
        if (folded) return folded;
      }
    }
  }

  // 9b) aliases explícitos por linha-alvo (rejeita alvo dividido/removido).
  const aliasByLine = new Map<number, string[]>();
  for (const d of input.decisions) {
    if (d.kind !== 'RegisterAlias') continue;
    const target = d.targetLineNumber;
    const f = fate.get(target);
    if (f && f.kind === 'split') {
      return structuralInvalid('CONFLICTING_DECISIONS', `alias aponta para a linha ${target}, que foi dividida`);
    }
    if (f && f.kind === 'fold') {
      return structuralInvalid('CONFLICTING_DECISIONS', `alias aponta para a linha ${target}, que foi removida`);
    }
    const arr = aliasByLine.get(target) ?? [];
    arr.push(normalizePricingName(d.alias));
    aliasByLine.set(target, arr);
  }

  // 9c) proveniência de issues por linha (as excludes vão para excludedLines).
  const lineIssueIds = new Map<number, Set<string>>();
  const attribute = (line: number, id: string): void => {
    const s = lineIssueIds.get(line) ?? new Set<string>();
    s.add(id);
    lineIssueIds.set(line, s);
  };
  for (const d of input.decisions) {
    switch (d.kind) {
      case 'KeepGroupingAsSingleArea':
      case 'KeepPossibleAliasLiteral':
      case 'SplitGroupingIntoAreas': {
        const ref = refById.get(d.issueId);
        if (ref && ref.lineNumber !== null) attribute(ref.lineNumber, d.issueId);
        break;
      }
      case 'RegisterAlias':
        attribute(d.targetLineNumber, d.issueId);
        break;
      case 'ConsolidateDuplicate':
      case 'ChooseDuplicateVariant':
        attribute(d.keepLineNumber, d.issueId);
        break;
      case 'KeepConflictSeparate': {
        for (const id of d.issueIds) {
          const ref = refById.get(id);
          if (!ref) continue;
          const lines = ref.lineNumbers ?? (ref.lineNumber !== null ? [ref.lineNumber] : []);
          for (const line of lines) attribute(line, id);
        }
        break;
      }
      case 'ExcludeLine':
        break;
    }
  }

  // 9d) emitir itens iterando os itens do parse em ordem de linha.
  const emitted: EmittedItem[] = [];
  const uniqueAliases = (arr: readonly string[] | undefined): string[] => [...new Set(arr ?? [])];
  const issuesForLines = (lines: readonly number[]): Set<string> => {
    const out = new Set<string>();
    for (const line of lines) for (const id of lineIssueIds.get(line) ?? []) out.add(id);
    return out;
  };

  for (const it of items) {
    const f = fate.get(it.lineNumber);
    if (f && f.kind === 'fold') continue; // consolidado no sobrevivente

    if (!isPositiveCents(it.amountCents)) {
      // Inalcançável em `valid` (preço ausente vira issue bloqueante). Defensivo.
      return structuralInvalid('INVALID_RESOLVED_ITEM', `linha ${it.lineNumber} sem preço válido`);
    }
    const price: Cents = it.amountCents;

    if (f && f.kind === 'split') {
      for (let idx = 0; idx < f.names.length; idx += 1) {
        const name = f.names[idx];
        emitted.push({
          displayName: name,
          nameNormalized: normalizePricingName(name),
          aliases: [], // itens derivados de split não herdam alias
          amountCents: price,
          sourceLineNumbers: [it.lineNumber],
          issueIds: issuesForLines([it.lineNumber]),
          primaryLine: it.lineNumber,
          subIndex: idx,
        });
      }
      continue;
    }

    if (f && f.kind === 'survivor') {
      const src = [...f.candidateLines].sort((a, b) => a - b);
      emitted.push({
        displayName: it.displayName, // nome/preço da keepLineNumber (é esta linha)
        nameNormalized: it.nameNormalized,
        aliases: uniqueAliases(aliasByLine.get(it.lineNumber)),
        amountCents: price,
        sourceLineNumbers: src,
        issueIds: issuesForLines(src),
        primaryLine: src.length > 0 ? Math.min(...src) : it.lineNumber,
        subIndex: 0,
      });
      continue;
    }

    // manutenção simples (com alias explícito, quando houver).
    emitted.push({
      displayName: it.displayName,
      nameNormalized: it.nameNormalized,
      aliases: uniqueAliases(aliasByLine.get(it.lineNumber)),
      amountCents: price,
      sourceLineNumbers: [it.lineNumber],
      issueIds: issuesForLines([it.lineNumber]),
      primaryLine: it.lineNumber,
      subIndex: 0,
    });
  }

  // 9e) ordem determinística: menor linha de origem → índice do split → nome.
  emitted.sort(
    (a, b) =>
      a.primaryLine - b.primaryLine ||
      a.subIndex - b.subIndex ||
      (a.nameNormalized < b.nameNormalized ? -1 : a.nameNormalized > b.nameNormalized ? 1 : 0),
  );

  // 9f) linhas excluídas (somente unparsed; preserva rawLine e reason).
  const excludedLines: ExcludedPricingLine[] = [];
  const excludedSeen = new Set<number>();
  for (const d of input.decisions) {
    if (d.kind !== 'ExcludeLine') continue;
    const u = parse.unparsed.find((x) => x.lineNumber === d.lineNumber);
    if (!u) {
      // Inalcançável em `valid` (a 3B-1 exige linha em unparsed). Defensivo.
      return structuralInvalid('INVALID_PROVENANCE', `exclusão sem linha unparsed: ${d.lineNumber}`);
    }
    if (excludedSeen.has(d.lineNumber)) {
      return structuralInvalid('CONFLICTING_DECISIONS', `linha ${d.lineNumber} excluída mais de uma vez`);
    }
    excludedSeen.add(d.lineNumber);
    excludedLines.push({ lineNumber: d.lineNumber, rawLine: u.rawLine, reason: d.reason, issueId: d.issueId });
  }
  excludedLines.sort((a, b) => a.lineNumber - b.lineNumber);

  // 10) contabilidade: nenhuma linha de item original pode desaparecer.
  const coveredLines = new Set<number>();
  for (const e of emitted) for (const line of e.sourceLineNumbers) coveredLines.add(line);
  for (const it of items) {
    if (!coveredLines.has(it.lineNumber)) {
      return structuralInvalid('UNACCOUNTED_SOURCE_LINE', `linha de item não contabilizada: ${it.lineNumber}`);
    }
  }

  // 11) validação estrutural da proposta antes de retornar `resolved`.
  if (emitted.length > MAX_PRICING_AREAS) {
    return structuralInvalid('TOO_MANY_RESOLVED_AREAS', `acima de ${MAX_PRICING_AREAS} áreas resolvidas`);
  }
  const names = new Set<string>();
  for (const e of emitted) {
    if (!isPositiveCents(e.amountCents)) return structuralInvalid('INVALID_RESOLVED_ITEM', 'preço inválido');
    if (e.displayName.trim().length === 0) return structuralInvalid('INVALID_RESOLVED_ITEM', 'displayName vazio');
    if (e.displayName.length > MAX_PRICING_DISPLAY_NAME_LENGTH) {
      return structuralInvalid('INVALID_RESOLVED_ITEM', 'displayName acima do limite');
    }
    if (e.nameNormalized !== normalizePricingName(e.displayName) || e.nameNormalized.length === 0) {
      return structuralInvalid('INVALID_RESOLVED_ITEM', 'nameNormalized incoerente');
    }
    if (names.has(e.nameNormalized)) return structuralInvalid('DUPLICATE_RESOLVED_NAME', e.nameNormalized);
    names.add(e.nameNormalized);

    if (e.sourceLineNumbers.length === 0) return structuralInvalid('INVALID_PROVENANCE', 'sem linha de origem');
    for (const line of e.sourceLineNumbers) {
      if (!itemLineSet.has(line)) return structuralInvalid('INVALID_PROVENANCE', `linha de origem inexistente: ${line}`);
    }
    for (const id of e.issueIds) {
      if (!issueIndexById.has(id)) return structuralInvalid('INVALID_PROVENANCE', `issueId inválido: ${id}`);
    }
  }

  // Aliases: forma canônica, limites e sem colisão com nomes/aliases de terceiros.
  const aliasOwners = new Set<string>();
  for (const e of emitted) {
    if (e.aliases.length > MAX_PRICING_ALIASES) return structuralInvalid('INVALID_RESOLVED_ITEM', 'aliases acima do limite');
    const local = new Set<string>();
    for (const a of e.aliases) {
      if (a.length === 0 || a.length > MAX_PRICING_ALIAS_LENGTH) return structuralInvalid('INVALID_RESOLVED_ITEM', 'alias inválido');
      if (a !== normalizePricingName(a)) return structuralInvalid('INVALID_RESOLVED_ITEM', 'alias fora da forma canônica');
      if (a === e.nameNormalized) return structuralInvalid('RESOLVED_ALIAS_CONFLICT', 'alias igual ao próprio nome');
      if (local.has(a)) return structuralInvalid('RESOLVED_ALIAS_CONFLICT', 'alias duplicado no item');
      local.add(a);
      if (names.has(a)) return structuralInvalid('RESOLVED_ALIAS_CONFLICT', `alias colide com nome de área: ${a}`);
      if (aliasOwners.has(a)) return structuralInvalid('RESOLVED_ALIAS_CONFLICT', `alias colide com alias de outra área: ${a}`);
      aliasOwners.add(a);
    }
  }

  // 12) montar a proposta imutável (arrays copiados; issueIds em ordem por índice).
  const proposal: ResolvedPricingProposal = {
    analysisKey: key,
    items: emitted.map((e) => ({
      displayName: e.displayName,
      nameNormalized: e.nameNormalized,
      aliases: e.aliases.slice(),
      amountCents: e.amountCents,
      provenance: {
        sourceLineNumbers: e.sourceLineNumbers.slice(),
        sourceIssueIds: [...e.issueIds].sort(
          (a, b) => (issueIndexById.get(a) ?? 0) - (issueIndexById.get(b) ?? 0),
        ),
      },
    })),
    excludedLines: excludedLines.slice(),
    appliedIssueIds: refs.map((r) => r.issueId), // cobertura total garantida por `valid`
  };

  return { ok: true, state: 'resolved', proposal };
}
