/**
 * Domínio de roteamento (distância/tempo entre dois pontos).
 *
 * Interface neutra: o app depende dela, não do Google. Assim dá para trocar
 * o provedor (Google, OSRM, etc.) sem mudar quem consome.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface RouteResult {
  /** Distância em quilômetros. */
  km: number;
  /** Duração em minutos. */
  min: number;
  /** true quando o valor é uma estimativa (não veio de um provedor real). */
  approx: boolean;
}

export interface RoutingProvider {
  /** Rota de carro entre dois pontos, ou null se indisponível. */
  route(origin: GeoPoint, destination: GeoPoint): Promise<RouteResult | null>;
}
