/**
 * Implementação de `RequestHasher` com SHA-256 (DEC-019.2). Vive no server
 * (`functions/src/`) e usa apenas `node:crypto` — sem firebase-admin, callable
 * ou ambiente. O `requestHash` armazenado é o digest hex, NUNCA o JSON completo.
 *
 * Determinístico: a mesma string canônica produz sempre o mesmo digest, o que
 * mantém a idempotência estável entre retries.
 */

import { createHash } from 'node:crypto';
import type { RequestHasher } from './ports';

export class Sha256RequestHasher implements RequestHasher {
  hashCanonical(canonical: string): string {
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
}
