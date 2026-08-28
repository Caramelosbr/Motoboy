/**
 * Casos de uso de Abastecimentos (camada de aplicação).
 *
 * Orquestra o domínio e depende apenas da interface AbastecimentoRepository
 * (injetada). Não conhece Firestore nem DOM — o que permite testar as regras
 * isoladamente e trocar a persistência sem mexer aqui.
 */

import type {
  Abastecimento,
  AbastecimentoRepository,
  EditAbastecimento,
  NewAbastecimento,
} from '../domain/abastecimento';

export class AbastecimentoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbastecimentoValidationError';
  }
}

function validateNew(data: NewAbastecimento): void {
  if (!data.location || !data.location.trim()) {
    throw new AbastecimentoValidationError('Informe o posto.');
  }
  if (!data.dateISO) {
    throw new AbastecimentoValidationError('Informe a data.');
  }
  if (!(data.paidValue > 0)) {
    throw new AbastecimentoValidationError('O valor pago deve ser maior que zero.');
  }
  if (!(data.pricePerLiter > 0)) {
    throw new AbastecimentoValidationError('O preço por litro deve ser maior que zero.');
  }
}

export class AbastecimentosService {
  constructor(private readonly repo: AbastecimentoRepository) {}

  list(): Promise<Abastecimento[]> {
    return this.repo.list();
  }

  observe(callback: (items: Abastecimento[]) => void): () => void {
    return this.repo.observe(callback);
  }

  add(data: NewAbastecimento): Promise<Abastecimento> {
    validateNew(data);
    return this.repo.add({
      ...data,
      location: data.location.trim(),
      odometer: data.odometer ?? null,
    });
  }

  update(id: string, data: EditAbastecimento): Promise<void> {
    if (data.location !== undefined && !data.location.trim()) {
      throw new AbastecimentoValidationError('Informe o posto.');
    }
    if (data.paidValue !== undefined && !(data.paidValue > 0)) {
      throw new AbastecimentoValidationError('O valor pago deve ser maior que zero.');
    }
    if (data.pricePerLiter !== undefined && !(data.pricePerLiter > 0)) {
      throw new AbastecimentoValidationError('O preço por litro deve ser maior que zero.');
    }
    return this.repo.update(id, data);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
