/**
 * Composition root da feature Abastecimentos.
 *
 * Único lugar que conhece as implementações concretas: monta o serviço com o
 * repositório Firestore, escopado pelo uid do usuário autenticado. O resto do
 * app importa apenas `abastecimentosService` (e os tipos do domínio).
 */

import { currentUid } from '../auth/application/auth-service';
import { AbastecimentosService } from './application/abastecimentos-service';
import { FirestoreAbastecimentoRepository } from './infrastructure/firestore-abastecimento-repository';

const repository = new FirestoreAbastecimentoRepository(() => currentUid());

export const abastecimentosService = new AbastecimentosService(repository);

export { AbastecimentoValidationError } from './application/abastecimentos-service';
export type {
  Abastecimento,
  NewAbastecimento,
  EditAbastecimento,
} from './domain/abastecimento';
