/**
 * Dispatch geometry: in what order should a route's stops be driven?
 *
 * All of it is geometry over data the board already has — `Task.coordinates`
 * is a "lat,lng" string the backend stores. No routing service, no traffic, no
 * API: straight-line kilometres and a greedy nearest-neighbour walk. That is
 * deliberately crude, and it is why the output is a *proposal* with its
 * numbers shown, not an auto-reorder. The dispatcher knows about the bridge
 * that is closed; this only knows that two sites are 3 km apart.
 *
 * There used to be a second heuristic here, `suggestRouteGroup`, which
 * proposed unassigned jobs to add to a route. It was removed (TODO-16):
 * recommended additions to routes are not wanted. `distanceKm` is also used by
 * the map feature.
 */

import { parseCoordinates, type LatLng, type Task } from '@/types/domain';

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

function pointOf(task: Task): LatLng | null {
  return parseCoordinates(task.coordinates);
}

/** Total length of a path through the stops that have coordinates. */
export function pathLengthKm(tasks: readonly Task[]): number {
  const points = tasks.map(pointOf).filter((point): point is LatLng => point !== null);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceKm(points[index - 1]!, points[index]!);
  }
  return total;
}
/** Greedy nearest-neighbour ordering, starting from `from` (or the first task). */
export function orderByProximity(tasks: readonly Task[], from: LatLng | null): Task[] {
  const remaining = [...tasks];
  const ordered: Task[] = [];
  let cursor = from;

  while (remaining.length > 0) {
    let bestIndex = 0;
    if (cursor) {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < remaining.length; index += 1) {
        const point = pointOf(remaining[index]!);
        // Stops with no coordinates sort to the end: they cannot be optimised,
        // and pretending otherwise would move real stops around them.
        const distance = point && cursor ? distanceKm(cursor, point) : Number.POSITIVE_INFINITY;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    if (!next) break;
    ordered.push(next);
    cursor = pointOf(next) ?? cursor;
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Is this route driven in a sensible order?
// ---------------------------------------------------------------------------

/** Below this the reshuffle is not worth the dispatcher's attention. */
export const MIN_SAVING_KM = 2;

export interface ReorderSuggestion {
  orderedIds: number[];
  currentKm: number;
  proposedKm: number;
  savedKm: number;
  /** Romanian summary for the panel. */
  summary: string;
}

/**
 * Re-sequences the route's stops nearest-neighbour from the current first stop
 * and reports the straight-line saving. Returns null when the current order is
 * already good, when the saving is trivial, or when there is not enough
 * geometry to say anything — silence is the right answer more often than not.
 *
 * The first stop is kept: it is usually the depot or the driver's start, and
 * this cannot know that, so it does not touch it.
 */
export function suggestStopOrder(routeTasks: readonly Task[]): ReorderSuggestion | null {
  const withPoints = routeTasks.filter((task) => pointOf(task) !== null);
  if (routeTasks.length < 3 || withPoints.length < 3) return null;

  const [first, ...rest] = routeTasks;
  if (!first) return null;

  const proposed = [first, ...orderByProximity(rest, pointOf(first))];
  const currentKm = pathLengthKm(routeTasks);
  const proposedKm = pathLengthKm(proposed);
  const savedKm = currentKm - proposedKm;

  if (savedKm < MIN_SAVING_KM) return null;

  const orderedIds = proposed.map((task) => task.id);
  if (orderedIds.every((id, index) => id === routeTasks[index]?.id)) return null;

  return {
    orderedIds,
    currentKm,
    proposedKm,
    savedKm,
    summary: `Reordonarea opririlor scurtează traseul cu ~${savedKm.toFixed(1)} km (${currentKm.toFixed(
      1,
    )} → ${proposedKm.toFixed(1)} km în linie dreaptă).`,
  };
}
