/**
 * API pública do domínio de pricing (Tabela de deslocamento — DEC-020).
 * Sem default export; sem helpers internos; sem ciclos.
 */

export { normalizePricingName } from './normalize-pricing-name';

export type {
  PricingArea,
  NewPricingArea,
  PricingAreaType,
  PricingAreaErrorCode,
  PricingAreaValidation,
  PricingAreaResult,
} from './pricing-area';
export {
  createPricingArea,
  validatePricingArea,
  MAX_PRICING_AREAS,
  MAX_PRICING_AREA_ID_LENGTH,
  MAX_PRICING_DISPLAY_NAME_LENGTH,
  MAX_PRICING_ALIASES,
  MAX_PRICING_ALIAS_LENGTH,
} from './pricing-area';

export type { PricingMatchBy, PricingAreaMatch } from './match-pricing-area';
export { matchPricingArea } from './match-pricing-area';

export type {
  PricingPasteFatalCode,
  PricingPasteIssueCode,
  PricingPriceSource,
  ParsedPricingItem,
  ParsedPriceGroup,
  PricingPasteIssue,
  ParsedUnparsedLine,
  PricingPasteParseResult,
} from './paste-parser';
export {
  parsePricingTablePaste,
  MAX_PRICING_IMPORT_TEXT_LENGTH,
  MAX_PRICING_IMPORT_LINES,
} from './paste-parser';

export type {
  PricingDiffErrorCode,
  PricingDiffNew,
  PricingDiffChanged,
  PricingDiffUnchanged,
  PricingDiffRemoved,
  PricingDiffConflict,
  PricingTableDiffCounts,
  PricingTableDiffResult,
} from './pricing-table-diff';
export { diffPricingTable } from './pricing-table-diff';

export type { PricingAnalysisKeyResult } from './pricing-analysis-key';
export { buildPricingAnalysisKey } from './pricing-analysis-key';

export type {
  PricingIssueReference,
  PricingImportDecision,
  PricingImportDecisionsErrorCode,
  PricingImportDecisionsResult,
  ValidatePricingImportDecisionsInput,
} from './pricing-import-decision';
export { buildIssueReferences, validatePricingImportDecisions } from './pricing-import-decision';

export type {
  ResolvedPricingItem,
  ResolvedPricingItemProvenance,
  ExcludedPricingLine,
  ResolvedPricingProposal,
  ResolvePricingProposalStructuralErrorCode,
  PricingProposalResolutionResult,
  ResolvePricingProposalInput,
} from './resolve-pricing-proposal';
export { resolvePricingProposal } from './resolve-pricing-proposal';

export type {
  ResolvedPricingDiffErrorCode,
  ResolvedPricingDiffNew,
  ResolvedPricingDiffChanged,
  ResolvedPricingDiffUnchanged,
  ResolvedPricingDiffRemoved,
  ResolvedPricingDiffConflict,
  ResolvedPricingDiffCounts,
  ResolvedPricingDiffResult,
  DiffResolvedPricingTableInput,
} from './resolve-pricing-diff';
export { diffResolvedPricingTable } from './resolve-pricing-diff';
