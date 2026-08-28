/**
 * Provedor de roteamento usando a Google Routes API (computeRoutes).
 *
 * A Routes API (routes.googleapis.com) aceita chamadas do navegador (CORS),
 * diferente da Directions API clássica. Sem chave configurada, retorna null
 * para o chamador cair no fallback (OSRM/linha reta).
 */

import type { GeoPoint, RouteResult, RoutingProvider } from '../domain/routing';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** "1234s" | 1234 → segundos. */
function parseDurationSeconds(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }
  return 0;
}

export class GoogleRoutesProvider implements RoutingProvider {
  constructor(private readonly getApiKey: () => string | undefined) {}

  async route(origin: GeoPoint, destination: GeoPoint): Promise<RouteResult | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null; // sem chave: deixa o chamador usar o fallback

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      });

      if (!response.ok) return null;
      const data: unknown = await response.json();
      const route = (data as { routes?: Array<{ distanceMeters?: number; duration?: unknown }> })
        ?.routes?.[0];
      if (!route || typeof route.distanceMeters !== 'number') return null;

      return {
        km: route.distanceMeters / 1000,
        min: Math.round(parseDurationSeconds(route.duration) / 60),
        approx: false,
      };
    } catch {
      return null;
    }
  }
}
