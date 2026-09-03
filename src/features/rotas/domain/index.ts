/**
 * API pública do domínio de Rotas (histórico de rotas confirmadas).
 * Sem default export; sem helpers internos; sem ciclos.
 */

export type {
  RotaEntrega,
  RotaService,
  Rota,
  RotaRepository,
  NewRotaEntrega,
  NewRotaService,
  NewRota,
  RotaErrorCode,
  RotaResult,
  RotaValidation,
} from './rota';

export {
  createRota,
  validateRota,
  roundRouteValue,
  computeServicoTotal,
  computeRotasValorTotal,
  countAllEntregas,
  computeFuelCost,
  computeRouteResultado,
  computeReceivedPending,
  MAX_ROTA_ID_LENGTH,
  ROTA_ID_PATTERN,
  ROTA_PAYMENT_STATUS_RECEIVED,
} from './rota';
