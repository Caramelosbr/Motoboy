/**
 * Validadores puros de identificadores do núcleo financeiro.
 *
 * Esta etapa apenas VALIDA; não gera IDs. Objetivo: nenhum identificador
 * inseguro chega a formar caminho do Firestore (ver DEC-016).
 */

// idempotencyKey: letras, números, hífen e underscore; 1 a 64 caracteres.
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{1,64}$/;

// serviceId: svc_ + UUIDv4 em lowercase (versão 4, variante 8/9/a/b).
const SERVICE_ID =
  /^svc_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// routeId: letras, números, hífen e underscore (sem barra, sem ".").
const ROUTE_ID_CHARS = /^[A-Za-z0-9_-]+$/;
const ROUTE_ID_MAX = 128;

/** true se `value` casa exatamente `^[A-Za-z0-9_-]{1,64}$`. */
export function isValidIdempotencyKey(value: string): boolean {
  return typeof value === 'string' && IDEMPOTENCY_KEY.test(value);
}

/** true se `value` é `svc_{UUIDv4}` em lowercase (uppercase é rejeitado). */
export function isValidServiceId(value: string): boolean {
  return typeof value === 'string' && SERVICE_ID.test(value);
}

/**
 * true se `value` é um routeId seguro para o novo núcleo:
 * não vazio, até 128 chars, só [A-Za-z0-9_-], sem barra, sem "."/"..",
 * e sem padrão reservado iniciado e terminado por "__".
 */
export function isValidRouteId(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > ROUTE_ID_MAX) return false;
  if (!ROUTE_ID_CHARS.test(value)) return false; // exclui "/", ".", ".." e espaços
  if (value.startsWith('__') && value.endsWith('__')) return false; // reservado
  return true;
}
