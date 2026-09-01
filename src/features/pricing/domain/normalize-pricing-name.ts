/**
 * Normalização pura de nomes de área de preço (bairro/área/condomínio/empresa/
 * ponto de referência). Base para busca e prevenção de duplicidade — NUNCA a
 * identidade oficial (ver DEC-020).
 *
 * Contrato: trim; minúsculas (pt-BR); remove acentos; pontuação/separadores
 * viram espaço; preserva letras e números; colapsa espaços. Nunca infere alias,
 * nunca divide nomes, nunca interpreta números como preço. Sem I/O, sem relógio.
 */

// Faixa de diacríticos combinantes U+0300–U+036F (fonte ASCII inequívoca).
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
const NON_ALNUM = /[^\p{L}\p{N}]+/gu;
const SPACES = /\s+/g;

export function normalizePricingName(value: string): string {
  if (typeof value !== 'string') return '';
  let s = value.trim().toLocaleLowerCase('pt-BR');
  // Remove acentos (decompõe e descarta os diacríticos).
  if (typeof s.normalize === 'function') {
    s = s.normalize('NFD').replace(COMBINING_MARKS, '');
  }
  // Tudo que não for letra ou número (unicode) vira espaço — pontuação,
  // hífen, parênteses, separadores etc. Letras e números são preservados.
  s = s.replace(NON_ALNUM, ' ');
  // Colapsa espaços e remove das pontas.
  return s.replace(SPACES, ' ').trim();
}
