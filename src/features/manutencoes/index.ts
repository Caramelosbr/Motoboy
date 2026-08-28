/**
 * Composition root da feature Manutenções.
 * Monta o serviço com o repositório Firestore, escopado pelo uid atual.
 */

import { currentUid } from '../auth/application/auth-service';
import { ManutencoesService } from './application/manutencoes-service';
import { FirestoreManutencaoRepository } from './infrastructure/firestore-manutencao-repository';

const repository = new FirestoreManutencaoRepository(() => currentUid());

export const manutencoesService = new ManutencoesService(repository);

export { ManutencaoValidationError } from './application/manutencoes-service';
export type { Manutencao, NewManutencao, EditManutencao } from './domain/manutencao';
