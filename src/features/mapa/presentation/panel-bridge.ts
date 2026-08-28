/**
 * Ponte de roteamento para o painel legado.
 * Expõe window.__motoboyRoute; o monólito tenta o Google primeiro e, se vier
 * null, cai no OSRM/linha reta (fallback que já existe lá).
 */

import { routingProvider } from '../index';
import type { GeoPoint, RouteResult } from '../index';

declare global {
  interface Window {
    __motoboyRoute?: (origin: GeoPoint, destination: GeoPoint) => Promise<RouteResult | null>;
  }
}

export function installMapaBridge(): void {
  window.__motoboyRoute = (origin, destination) => routingProvider.route(origin, destination);
}
