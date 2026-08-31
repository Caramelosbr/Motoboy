/**
 * Validações puras para `effectiveDate` no formato `AAAA-MM-DD`.
 *
 * Não constrói objetos de data nem serializa datas, e não usa nenhuma API
 * dependente de fuso ou relógio.
 * A comparação de datas é lexicográfica (ISO zero-padded ordena corretamente).
 * O dia oficial ("hoje") é sempre fornecido pelo chamador — futuramente o dia
 * em America/Sao_Paulo calculado no servidor (ver DEC-018).
 */

export type DateOk = { readonly ok: true };
export type DateError = { readonly ok: false; readonly error: string };
export type DateValidation = DateOk | DateError;

const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1];
}

/** true se `iso` é uma data real no formato AAAA-MM-DD (mês, dia e bissexto válidos). */
export function isValidEffectiveDate(iso: string): boolean {
  if (typeof iso !== 'string' || !ISO_SHAPE.test(iso)) return false;
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

/** Valida o formato/realidade de `effectiveDate`, como Result discriminado. */
export function validateEffectiveDate(effectiveDate: string): DateValidation {
  return isValidEffectiveDate(effectiveDate)
    ? { ok: true }
    : { ok: false, error: 'Data inválida (esperado AAAA-MM-DD real).' };
}

/**
 * Valida que `effectiveDate` não é futura em relação a `todayISO` (ambos AAAA-MM-DD).
 * Não consulta o relógio: `todayISO` é fornecido pelo chamador. Igual a hoje é aceito.
 */
export function validateEffectiveDateNotFuture(
  effectiveDate: string,
  todayISO: string,
): DateValidation {
  if (!isValidEffectiveDate(effectiveDate)) {
    return { ok: false, error: 'Data inválida (esperado AAAA-MM-DD real).' };
  }
  if (!isValidEffectiveDate(todayISO)) {
    return { ok: false, error: 'Data de referência (hoje) inválida.' };
  }
  if (effectiveDate > todayISO) {
    return { ok: false, error: 'A data não pode ser futura.' };
  }
  return { ok: true };
}
