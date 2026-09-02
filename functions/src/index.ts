/**
 * Entrypoint mínimo das Cloud Functions (DEC-019.1) — SCAFFOLD.
 *
 * Não há callable, regra financeira, App Check nem lógica autoritativa aqui.
 * Este arquivo apenas: (1) importa um símbolo REAL do núcleo compartilhado em
 * `src/` (via `../../src/…`) para provar que o núcleo é INLINADO no bundle; e
 * (2) referencia o SDK `firebase-functions` como dependência EXTERNA (não deve
 * ser incorporada ao bundle). A auditoria do metafile verifica ambos.
 */

import { formatCentsBRL, toCents } from '../../src/shared/currency';
import * as functions from 'firebase-functions';

// Prova de inlining do núcleo (sem expor nada autoritativo).
export const scaffoldInfo = {
  runtime: 'nodejs22',
  coreSample: formatCentsBRL(toCents(0)),
  functionsSdkLoaded: typeof functions === 'object',
} as const;
