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
