/**
 * API pública do domínio Customer. Sem default export; sem helpers internos.
 */

export type { Customer, CustomerStatus, CustomerErrorCode, CustomerValidation } from './customer';
export { validateCustomer, archiveCustomer } from './customer';
