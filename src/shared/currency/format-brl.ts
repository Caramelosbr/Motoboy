/**
 * Formatação de `Cents` para exibição em Real (BRL), locale fixo pt-BR.
 *
 * O valor de domínio permanece inteiro em centavos: a parte de reais é separada
 * por aritmética inteira exata e só o agrupamento de milhares usa
 * `Intl.NumberFormat` (sobre um inteiro, nunca sobre float). Não depende do
 * locale do dispositivo.
 */

import type { Cents } from './cents';

// Agrupador de milhares pt-BR aplicado a um inteiro (parte em reais).
const REAIS_GROUPING = new Intl.NumberFormat('pt-BR', {
  useGrouping: true,
  maximumFractionDigits: 0,
});

/**
 * Formata `Cents` como "R$ 1.234,56" (locale pt-BR fixo, sempre duas casas).
 * @throws {RangeError} se `value` não for inteiro não negativo (contrato de Cents).
 */
export function formatCentsBRL(value: Cents): string {
  const n = value as number;
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError('formatCentsBRL espera Cents (inteiro não negativo).');
  }
  const cc = n % 100;
  const reais = (n - cc) / 100; // divisão exata (n-cc é múltiplo de 100)
  return `R$ ${REAIS_GROUPING.format(reais)},${String(cc).padStart(2, '0')}`;
}
