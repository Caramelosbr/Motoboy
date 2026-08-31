import { describe, it, expect } from 'vitest';
import { isValidIdempotencyKey, isValidServiceId, isValidRouteId } from './index';

describe('isValidIdempotencyKey', () => {
  it('aceita comprimento mínimo (1)', () => {
    expect(isValidIdempotencyKey('a')).toBe(true);
  });
  it('aceita comprimento máximo (64)', () => {
    expect(isValidIdempotencyKey('a'.repeat(64))).toBe(true);
  });
  it('aceita letras, números, hífen e underscore', () => {
    expect(isValidIdempotencyKey('Abc-123_XYZ')).toBe(true);
  });
  it('rejeita acima de 64', () => {
    expect(isValidIdempotencyKey('a'.repeat(65))).toBe(false);
  });
  it('rejeita vazio', () => {
    expect(isValidIdempotencyKey('')).toBe(false);
  });
  it('rejeita barra', () => {
    expect(isValidIdempotencyKey('abc/def')).toBe(false);
  });
  it('rejeita espaço', () => {
    expect(isValidIdempotencyKey('abc def')).toBe(false);
  });
  it('rejeita caractere especial', () => {
    expect(isValidIdempotencyKey('abc$def')).toBe(false);
  });
});

describe('isValidServiceId', () => {
  const valido = 'svc_550e8400-e29b-41d4-a716-446655440000';
  it('aceita svc_{UUIDv4} válido', () => {
    expect(isValidServiceId(valido)).toBe(true);
  });
  it('rejeita versão errada (não 4)', () => {
    expect(isValidServiceId('svc_550e8400-e29b-11d4-a716-446655440000')).toBe(false);
  });
  it('rejeita variante errada (não 8/9/a/b)', () => {
    expect(isValidServiceId('svc_550e8400-e29b-41d4-c716-446655440000')).toBe(false);
  });
  it('rejeita UUID uppercase', () => {
    expect(isValidServiceId('svc_550E8400-E29B-41D4-A716-446655440000')).toBe(false);
  });
  it('rejeita sem prefixo svc_', () => {
    expect(isValidServiceId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
});

describe('isValidRouteId', () => {
  it('aceita routeId válido', () => {
    expect(isValidRouteId('rota-1756500000000')).toBe(true);
    expect(isValidRouteId('Rota_ABC-123')).toBe(true);
  });
  it('rejeita vazio', () => {
    expect(isValidRouteId('')).toBe(false);
  });
  it('rejeita acima de 128 caracteres', () => {
    expect(isValidRouteId('a'.repeat(129))).toBe(false);
  });
  it('aceita exatamente 128 caracteres', () => {
    expect(isValidRouteId('a'.repeat(128))).toBe(true);
  });
  it('rejeita barra', () => {
    expect(isValidRouteId('rota/1')).toBe(false);
  });
  it('rejeita "."', () => {
    expect(isValidRouteId('.')).toBe(false);
  });
  it('rejeita ".."', () => {
    expect(isValidRouteId('..')).toBe(false);
  });
  it('rejeita ponto interno', () => {
    expect(isValidRouteId('rota.1')).toBe(false);
  });
  it('rejeita padrão reservado __...__', () => {
    expect(isValidRouteId('__proto__')).toBe(false);
    expect(isValidRouteId('__reserved__')).toBe(false);
  });
});
