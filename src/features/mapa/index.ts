/**
 * Composition root da feature Mapa/Roteamento.
 * Lê a chave da Google Routes API do .env (VITE_GOOGLE_MAPS_API_KEY).
 */

import { GoogleRoutesProvider } from './infrastructure/google-routes-provider';

export const routingProvider = new GoogleRoutesProvider(
  () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
);

export type { GeoPoint, RouteResult } from './domain/routing';
