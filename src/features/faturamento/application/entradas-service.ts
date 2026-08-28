/**
 * Casos de uso de Faturamento/Entradas (aplicação).
 * Depende só da interface do repositório.
 */

import type {
  Entrada,
  EntradaRepository,
  EditEntrada,
  NewEntrada,
} from '../domain/entrada';

export class EntradaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntradaValidationError';
  }
}

function validateNew(data: NewEntrada): void {
  if (!data.desc || !data.desc.trim()) {
    throw new EntradaValidationError('Descreva a entrada.');
  }
  if (!data.dateISO) {
    throw new EntradaValidationError('Informe a data.');
  }
  if (!(data.valor > 0)) {
    throw new EntradaValidationError('O valor deve ser maior que zero.');
  }
}

export class EntradasService {
  constructor(private readonly repo: EntradaRepository) {}

  list(): Promise<Entrada[]> {
    return this.repo.list();
  }

  observe(callback: (items: Entrada[]) => void): () => void {
    return this.repo.observe(callback);
  }

  add(data: NewEntrada): Promise<Entrada> {
    validateNew(data);
    return this.repo.add({ ...data, desc: data.desc.trim() });
  }

  update(id: string, data: EditEntrada): Promise<void> {
    if (data.desc !== undefined && !data.desc.trim()) {
      throw new EntradaValidationError('Descreva a entrada.');
    }
    if (data.valor !== undefined && !(data.valor > 0)) {
      throw new EntradaValidationError('O valor deve ser maior que zero.');
    }
    return this.repo.update(id, data);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
