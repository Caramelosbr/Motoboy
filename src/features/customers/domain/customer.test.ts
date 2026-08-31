import { describe, it, expect } from 'vitest';
import { validateCustomer, archiveCustomer, type Customer } from './index';

const base: Customer = { id: 'c1', name: 'Restaurante do Zé', status: 'active' };

describe('validateCustomer', () => {
  it('criação válida', () => {
    expect(validateCustomer(base).ok).toBe(true);
  });
  it('aceita opcionais', () => {
    const c: Customer = { ...base, phone: '999', nickname: 'Zé', notes: 'fiado ok' };
    expect(validateCustomer(c).ok).toBe(true);
  });
  it('rejeita id vazio', () => {
    const r = validateCustomer({ ...base, id: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_ID');
  });
  it('rejeita nome vazio', () => {
    const r = validateCustomer({ ...base, name: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_NAME');
  });
  it('rejeita nome só com espaços', () => {
    const r = validateCustomer({ ...base, name: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_NAME');
  });
  it('nomes iguais em ids diferentes são aceitos', () => {
    expect(validateCustomer({ id: 'a', name: 'João', status: 'active' }).ok).toBe(true);
    expect(validateCustomer({ id: 'b', name: 'João', status: 'active' }).ok).toBe(true);
  });
});

describe('archiveCustomer', () => {
  it('cria nova entidade arquivada sem mutar a original', () => {
    const arquivado = archiveCustomer(base);
    expect(arquivado.status).toBe('archived');
    expect(arquivado).not.toBe(base);
    expect(base.status).toBe('active'); // original intacta
    expect(arquivado.id).toBe(base.id);
    expect(arquivado.name).toBe(base.name);
  });
  it('é idempotente para já arquivado', () => {
    const a1 = archiveCustomer(base);
    const a2 = archiveCustomer(a1);
    expect(a2.status).toBe('archived');
    expect(a1.status).toBe('archived');
  });
});
