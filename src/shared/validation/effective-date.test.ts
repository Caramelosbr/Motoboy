import { describe, it, expect } from 'vitest';
import {
  isValidEffectiveDate,
  validateEffectiveDate,
  validateEffectiveDateNotFuture,
} from './index';

describe('isValidEffectiveDate', () => {
  it('data comum válida', () => {
    expect(isValidEffectiveDate('2026-08-30')).toBe(true);
  });
  it('mês inválido', () => {
    expect(isValidEffectiveDate('2026-13-01')).toBe(false);
  });
  it('dia inválido', () => {
    expect(isValidEffectiveDate('2026-01-32')).toBe(false);
  });
  it('rejeita 31/02', () => {
    expect(isValidEffectiveDate('2026-02-31')).toBe(false);
  });
  it('aceita 29/02 em ano bissexto', () => {
    expect(isValidEffectiveDate('2024-02-29')).toBe(true);
  });
  it('rejeita 29/02 em ano não bissexto', () => {
    expect(isValidEffectiveDate('2026-02-29')).toBe(false);
  });
  it('rejeita ano secular não bissexto (1900)', () => {
    expect(isValidEffectiveDate('1900-02-29')).toBe(false);
  });
  it('aceita ano secular bissexto (2000)', () => {
    expect(isValidEffectiveDate('2000-02-29')).toBe(true);
  });
  it('rejeita formato incompleto', () => {
    expect(isValidEffectiveDate('2026-8-3')).toBe(false);
    expect(isValidEffectiveDate('2026-08')).toBe(false);
    expect(isValidEffectiveDate('30/08/2026')).toBe(false);
  });
});

describe('validateEffectiveDate', () => {
  it('ok para data real', () => {
    expect(validateEffectiveDate('2026-08-30').ok).toBe(true);
  });
  it('erro para data irreal', () => {
    expect(validateEffectiveDate('2026-02-31').ok).toBe(false);
  });
});

describe('validateEffectiveDateNotFuture', () => {
  const hoje = '2026-08-30';
  it('data igual a hoje é aceita', () => {
    expect(validateEffectiveDateNotFuture(hoje, hoje).ok).toBe(true);
  });
  it('data passada é aceita', () => {
    expect(validateEffectiveDateNotFuture('2026-08-29', hoje).ok).toBe(true);
  });
  it('data futura é rejeitada', () => {
    expect(validateEffectiveDateNotFuture('2026-08-31', hoje).ok).toBe(false);
  });
  it('effectiveDate irreal é rejeitada', () => {
    expect(validateEffectiveDateNotFuture('2026-02-31', hoje).ok).toBe(false);
  });
  it('hoje irreal é rejeitado', () => {
    expect(validateEffectiveDateNotFuture(hoje, '2026-13-40').ok).toBe(false);
  });
  it('não consulta relógio nem timezone: resultado só depende dos argumentos', () => {
    // Mesmos argumentos → mesmo resultado, independentemente de quando/onde roda.
    const a = validateEffectiveDateNotFuture('2020-01-01', '2020-01-01');
    const b = validateEffectiveDateNotFuture('2020-01-01', '2020-01-01');
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
    // Uma data "no futuro do relógio real" continua válida se today a comportar.
    expect(validateEffectiveDateNotFuture('2999-12-31', '2999-12-31').ok).toBe(true);
  });
});
