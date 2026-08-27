/**
 * Dispatch heuristics: which unassigned jobs belong on this route, and in what
 * order should its stops be driven.
 *
 * All of it is geometry over data the board already has — `Task.coordinates`
 * is a "lat,lng" string the backend stores, `Route.dayOfWeek` is the weekday
 * being planned (routes are weekly, not dated). No routing service, no traffic, no API: straight-line kilometres
 * and a greedy nearest-neighbour walk. That is deliberately crude, and it is
 * why the output is a *proposal* with its numbers shown, not an auto-assign.
 * The dispatcher knows about the bridge that is closed; this only knows that
 * two sites are 3 km apart.
 *
 * Two independent suggestions:
 *   suggestRouteGroup  jobs near this route's stops, on this route's day
 *   suggestStopOrder   the same stops re-sequenced to cut dead mileage
 */

import { parseCoordinates, type LatLng, type Route, type Task } from '@/types/domain';
import { taskDate } from './utils';

/**
 * Weekday (1 = Monday … 7 = Sunday) of an ISO date, matching
 * java.time.DayOfWeek — which is what `Route.dayOfWeek` holds.
 */
function weekdayOf(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const jsDay = parsed.getDay(); // 0 = Sunday
  return jsDay === 0 ? 7 : jsDay;
}

/** True when a task is scheduled on a different weekday than this route runs. */
function fallsOnAnotherDay(route: Route, isoDate: string | null): boolean {
  const day = weekdayOf(isoDate);
  return route.dayOfWeek !== null && day !== null && day !== route.dayOfWeek;
}

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

/**
 * The locality of an address: the last comma-separated chunk, which is how
 * every address in this system is written ("Str. Exemplu nr. 12, Otopeni").
 * Used as a fallback grouping key for tasks that have no coordinates.
 */
export function localityOf(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? last.toLocaleLowerCase('ro') : null;
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
// Which unassigned jobs belong on this route?
// ---------------------------------------------------------------------------

/** Nothing further than this from the route's stops is offered. */
export const NEARBY_RADIUS_KM = 25;
const DEFAULT_LIMIT = 8;

export interface GroupCandidate {
  task: Task;
  /** Straight-line km to the nearest existing stop; null when unknown. */
  distanceKm: number | null;
  /** Romanian one-liner explaining why this task is in the list. */
  reason: string;
}

export interface GroupSuggestion {
  candidates: GroupCandidate[];
  /** Existing stop ids followed by the proposed ones, in driving order. */
  orderedIds: number[];
  /** Estimated extra straight-line distance the additions cost. */
  addedKm: number;
  /** Romanian summary line for the panel header. */
  summary: string;
}

/**
 * The pool point with the most neighbours inside the radius — the middle of
 * the densest cluster of unassigned work. Used only to anchor a route that has
 * no stops of its own yet.
 */
function densestSeed(tasks: readonly Task[]): LatLng | null {
  const points = tasks.map(pointOf).filter((point): point is LatLng => point !== null);
  if (points.length === 0) return null;

  let best: LatLng | null = null;
  let bestCount = -1;
  for (const candidate of points) {
    const count = points.filter(
      (other) => distanceKm(candidate, other) <= NEARBY_RADIUS_KM,
    ).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

/**
 * Proposes unassigned tasks to append to `route`.
 *
 * Filters, in order:
 *   1. day — a task already scheduled for another date is never proposed;
 *      moving a job to a different day is a decision, not a convenience.
 *   2. place — within NEARBY_RADIUS_KM of one of the route's existing stops
 *      (or, for a route with no stops yet, of the densest cluster in the
 *      pool), falling back to a locality the route already serves, or the
 *      route's county, for tasks with no coordinates at all.
 * Survivors are ranked nearest-first and sequenced by `orderByProximity`
 * starting from the route's current last stop.
 */
export function suggestRouteGroup(
  route: Route,
  routeTasks: readonly Task[],
  pool: readonly Task[],
  limit = DEFAULT_LIMIT,
): GroupSuggestion | null {
  if (pool.length === 0) return null;

  const stopPoints = routeTasks
    .map(pointOf)
    .filter((point): point is LatLng => point !== null);
  const stopLocalities = new Set(
    routeTasks
      .map((task) => localityOf(task.address))
      .filter((value): value is string => value !== null),
  );
  const routeCounty = route.county?.toLocaleLowerCase('ro') ?? null;

  // An empty route has no geometry to attract anything, and that is exactly
  // when a grouping is most useful. So seed from the pool instead: the task
  // with the most neighbours inside the radius anchors the densest cluster of
  // work available on this day, and the route is built around it.
  const eligible = pool.filter((task) => !fallsOnAnotherDay(route, taskDate(task)));
  const seedPoint =
    stopPoints.length > 0 ? null : densestSeed(eligible);
  const anchors = stopPoints.length > 0 ? stopPoints : seedPoint ? [seedPoint] : [];

  const candidates: GroupCandidate[] = [];

  for (const task of pool) {
    const scheduled = taskDate(task);
    if (fallsOnAnotherDay(route, scheduled)) continue;

    const point = pointOf(task);
    const nearest =
      point && anchors.length > 0
        ? Math.min(...anchors.map((anchor) => distanceKm(anchor, point)))
        : null;

    if (nearest !== null) {
      if (nearest > NEARBY_RADIUS_KM) continue;
      const sameDay = weekdayOf(scheduled) !== null && weekdayOf(scheduled) === route.dayOfWeek;
      candidates.push({
        task,
        distanceKm: nearest,
        reason:
          stopPoints.length > 0
            ? `la ${nearest.toFixed(1)} km de traseul actual${sameDay ? ' · aceeași zi' : ''}`
            : `în aceeași zonă (${nearest.toFixed(1)} km de centrul grupului)${
                sameDay ? ' · aceeași zi' : ''
              }`,
      });
      continue;
    }

    // No usable geometry — fall back to place names.
    const locality = localityOf(task.address);
    const matchesLocality = locality !== null && stopLocalities.has(locality);
    const matchesCounty =
      routeCounty !== null &&
      task.address !== null &&
      task.address.toLocaleLowerCase('ro').includes(routeCounty);

    if (!matchesLocality && !matchesCounty) continue;
    candidates.push({
      task,
      distanceKm: null,
      reason: matchesLocality
        ? `aceeași localitate (${locality})`
        : `același județ (${route.county})`,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    if (left.distanceKm === null && right.distanceKm === null) return 0;
    if (left.distanceKm === null) return 1;
    if (right.distanceKm === null) return -1;
    return left.distanceKm - right.distanceKm;
  });

  // One nearby job is a drag-and-drop, not a grouping — staying quiet below
  // two keeps the panel from nagging on every route.
  if (candidates.length < 2) return null;

  const chosen = candidates.slice(0, limit);
  const lastStop = [...routeTasks].reverse().map(pointOf).find((point) => point !== null) ?? null;
  const sequenced = orderByProximity(
    chosen.map((candidate) => candidate.task),
    lastStop,
  );

  const before = pathLengthKm(routeTasks);
  const after = pathLengthKm([...routeTasks, ...sequenced]);

  return {
    candidates: sequenced.map(
      (task) => chosen.find((candidate) => candidate.task.id === task.id)!,
    ),
    orderedIds: [...routeTasks.map((task) => task.id), ...sequenced.map((task) => task.id)],
    addedKm: Math.max(0, after - before),
    summary:
      `${sequenced.length} ${sequenced.length === 1 ? 'sarcină neasignată se potrivește' : 'sarcini neasignate se potrivesc'}` +
      ` pe această rută (+${(after - before).toFixed(1)} km estimat).`,
  };
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
