/**
 * Casos de uso de Manutenções (aplicação). Depende só da interface do
 * repositório; não conhece Firestore nem DOM.
 */

import type {
  Manutencao,
  ManutencaoRepository,
  EditManutencao,
  NewManutencao,
} from '../domain/manutencao';

export class ManutencaoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManutencaoValidationError';
  }
}

function validateNew(data: NewManutencao): void {
  if (!data.category) {
    throw new ManutencaoValidationError('Informe a categoria do gasto.');
  }
  if (!data.desc || !data.desc.trim()) {
    throw new ManutencaoValidationError('Descreva o gasto.');
  }
  if (!data.dateISO) {
    throw new ManutencaoValidationError('Informe a data.');
  }
  if (!(data.valor > 0)) {
    throw new ManutencaoValidationError('O valor deve ser maior que zero.');
  }
}

export class ManutencoesService {
  constructor(private readonly repo: ManutencaoRepository) {}

  list(): Promise<Manutencao[]> {
    return this.repo.list();
  }

  observe(callback: (items: Manutencao[]) => void): () => void {
    return this.repo.observe(callback);
  }

  add(data: NewManutencao): Promise<Manutencao> {
    validateNew(data);
    return this.repo.add({
      ...data,
      desc: data.desc.trim(),
      km: data.km ?? null,
    });
  }

  update(id: string, data: EditManutencao): Promise<void> {
    if (data.desc !== undefined && !data.desc.trim()) {
      throw new ManutencaoValidationError('Descreva o gasto.');
    }
    if (data.valor !== undefined && !(data.valor > 0)) {
      throw new ManutencaoValidationError('O valor deve ser maior que zero.');
    }
    return this.repo.update(id, data);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
