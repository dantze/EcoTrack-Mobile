/**
 * Straight-line distance geometry shared by the dispatch board and the map
 * feature's route-length estimate.
 *
 * `TODO-16` removed the "recommended additions" suggestion UI that used to
 * live above the dispatch board's stop list (route grouping and stop
 * reordering proposals) along with the heuristics that fed it. `distanceKm`
 * survived because `@/features/map/data.ts` still imports it to estimate a
 * route's total straight-line kilometres.
 */

import type { LatLng } from '@/types/domain';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function distanceKm(from: LatLng, to: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
