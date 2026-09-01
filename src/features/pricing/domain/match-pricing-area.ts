/**
 * Matching EXATO (após normalização) entre candidatos neutros de texto e as
 * áreas de preço. Sem fuzzy, sem similaridade, sem Levenshtein, sem escolha
 * silenciosa. Não conhece Google, Photon, DOM ou Firestore — só strings.
 *
 * Resultado discriminado: none | unique | ambiguous (ver DEC-020).
 */

import type { PricingArea } from './pricing-area';
import { normalizePricingName } from './normalize-pricing-name';

export type PricingMatchBy = 'name' | 'alias';

export type PricingAreaMatch =
  | { readonly kind: 'none' }
  | { readonly kind: 'unique'; readonly area: PricingArea; readonly by: PricingMatchBy }
  | { readonly kind: 'ambiguous'; readonly areas: readonly PricingArea[] };

/**
 * Retorna a correspondência exata entre `candidates` (ex.: district, locality,
 * suburb) e `areas`. Um match no nome informa `by:'name'`; num alias, `by:'alias'`
 * (quando a mesma área casa por nome e por alias, prevalece `'name'`). Se o
 * conjunto casado resolver para mais de um `id`, o resultado é `ambiguous`
 * (áreas ordenadas por `id`, de forma determinística). Nada é mutado.
 */
export function matchPricingArea(
  areas: readonly PricingArea[],
  candidates: readonly string[],
): PricingAreaMatch {
  // 1) normaliza, ignora vazios, remove duplicados (preservando ordem).
  const normalizedCandidates: string[] = [];
  const seenCandidate = new Set<string>();
  for (const c of candidates) {
    const norm = normalizePricingName(typeof c === 'string' ? c : '');
    if (norm.length === 0 || seenCandidate.has(norm)) continue;
    seenCandidate.add(norm);
    normalizedCandidates.push(norm);
  }
  if (normalizedCandidates.length === 0) return { kind: 'none' };

  const candidateSet = new Set(normalizedCandidates);

  // 2) coleta áreas casadas (por id), registrando se casou por nome e/ou alias.
  const matched = new Map<string, { area: PricingArea; byName: boolean; byAlias: boolean }>();
  for (const area of areas) {
    const byName = candidateSet.has(area.nameNormalized);
    const byAlias = area.aliases.some((a) => candidateSet.has(a));
    if (!byName && !byAlias) continue;
    const prev = matched.get(area.id);
    if (prev) {
      prev.byName = prev.byName || byName;
      prev.byAlias = prev.byAlias || byAlias;
    } else {
      matched.set(area.id, { area, byName, byAlias });
    }
  }

  const ids = [...matched.keys()];
  if (ids.length === 0) return { kind: 'none' };

  if (ids.length === 1) {
    const only = matched.get(ids[0]);
    if (!only) return { kind: 'none' };
    return { kind: 'unique', area: only.area, by: only.byName ? 'name' : 'alias' };
  }

  const areasOut = ids
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => (matched.get(id) as { area: PricingArea }).area);
  return { kind: 'ambiguous', areas: areasOut };
}
