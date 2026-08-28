/**
 * Casos de uso de Rotas (aplicação). Rotas confirmadas são imutáveis:
 * só há confirmar (save) e cancelar (remove).
 */

import type { Rota, RotaRepository } from '../domain/rota';

export class RotaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RotaValidationError';
  }
}

export class RotasService {
  constructor(private readonly repo: RotaRepository) {}

  list(): Promise<Rota[]> {
    return this.repo.list();
  }

  observe(callback: (items: Rota[]) => void): () => void {
    return this.repo.observe(callback);
  }

  save(rota: Rota): Promise<void> {
    if (!rota.id) {
      throw new RotaValidationError('Rota sem id.');
    }
    return this.repo.save(rota);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
