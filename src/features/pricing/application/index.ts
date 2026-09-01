/**
 * API pública da application de pricing (DEC-020.3A). Sem default export.
 * NÃO exporta o fake de teste nem helpers internos. Sem ciclos.
 */

export type {
  ActivePricingTableSnapshot,
  PricingTableReadResult,
  PricingTableReadRepository,
} from './ports/pricing-table-read-repository';

export type { PricingImportAnalysisResult } from './use-cases/analyze-pricing-import';
export { analyzePricingImport } from './use-cases/analyze-pricing-import';
