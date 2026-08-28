/**
 * Composition root da feature Faturamento (entradas manuais).
 */

import { currentUid } from '../auth/application/auth-service';
import { EntradasService } from './application/entradas-service';
import { FirestoreEntradaRepository } from './infrastructure/firestore-entrada-repository';

const repository = new FirestoreEntradaRepository(() => currentUid());

export const entradasService = new EntradasService(repository);

export { EntradaValidationError } from './application/entradas-service';
export type { Entrada, NewEntrada, EditEntrada } from './domain/entrada';
