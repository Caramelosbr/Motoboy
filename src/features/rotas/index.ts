/**
 * Composition root da feature Rotas (histórico de rotas confirmadas).
 */

import { currentUid } from '../auth/application/auth-service';
import { RotasService } from './application/rotas-service';
import { FirestoreRotaRepository } from './infrastructure/firestore-rota-repository';

const repository = new FirestoreRotaRepository(() => currentUid());

export const rotasService = new RotasService(repository);

export { RotaValidationError } from './application/rotas-service';
export type {
  Rota,
  RotaEntrega,
  RotaService,
  RotaRepository,
  NewRota,
  NewRotaService,
  NewRotaEntrega,
  RotaErrorCode,
  RotaResult,
  RotaValidation,
} from './domain/rota';
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
} from './domain/rota';
