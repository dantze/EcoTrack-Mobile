/**
 * Pure projection from domain records to the map's own shapes (`./types`).
 *
 * Nothing here renders anything and nothing here talks to the API — it is a
 * single deterministic function of (orders, tasks, routes, filters, today),
 * which is what lets the whole "incoming vs done" story be unit-tested
 * without a map library or a browser. See `./types` for why the two layers
 * are split like this.
 */

import {
  ORDER_TYPES,
  parseCoordinates,
  clientName,
  type LatLng,
  type Order,
  type Route,
  type Task,
  type TaskStatus,
} from '@/types/domain';
import {
  isAmplasare,
  orderAddress,
  orderCoordinates,
  orderPrimaryDate,
  orderSummary,
} from '@/features/sales/orderModel';
import { sortByOrderIndex, isUnassigned, routeLabel } from '@/features/technical/utils';
import { distanceKm } from '@/features/technical/grouping';
import { fold } from '@/lib/search';
import {
  LIFECYCLES,
  LIFECYCLE_LABEL,
  ROUTE_PALETTE,
  type CountBucket,
  type Lifecycle,
  type MapBounds,
  type MapData,
  type MapFilters,
  type MapPoint,
  type MapRouteLine,
  type MapRouteStop,
  type MapStats,
} from './types';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Task evidence outranks dates because a task's status is what a technician
 * actually reported on site, while a date is only the plan. An order can be
 * completed early or start late; the moment there is a task, its status is
 * the better source of truth.
 */
function deriveLifecycle(order: Order, orderTasks: readonly Task[], today: string): Lifecycle {
  if (orderTasks.length > 0) {
    if (orderTasks.every((task) => task.status === 'COMPLETED')) return 'done';
    if (orderTasks.some((task) => task.status === 'IN_PROGRESS')) return 'active';

    // Every task is still NEW: nobody has touched this order's work. If the
    // anchor date is already behind us, that silence IS the signal — this is
    // the queue a dispatcher needs to look at, not just another "upcoming".
    const anchor = orderPrimaryDate(order);
    if (anchor && anchor < today) return 'overdue';
    // Anchor is today or in the future (or missing): no verdict from tasks
    // yet, so fall through to the same date reasoning an order with no tasks
    // at all would get.
  }

  return deriveLifecycleFromDates(order, today);
}

/**
 * Scheduling-only lifecycle, used when there is no conclusive task evidence.
 * Amplasari gets a window (start..end) because a placement occupies a site
 * for a stretch of time; Ridicari/Igienizari are single-instant visits, so
 * they only have a before/after.
 */
function deriveLifecycleFromDates(order: Order, today: string): Lifecycle {
  if (isAmplasare(order)) {
    const start = order.startDate;
    if (!start) return 'unknown';
    if (today < start) return 'upcoming';
    // An indefinite contract has no end to compare against, which reads the
    // same as an end date that has not arrived yet: still active.
    const end = order.isIndefinite ? null : order.endDate;
    if (!end || today <= end) return 'active';
    return 'done';
  }

  const date = orderPrimaryDate(order);
  if (!date) return 'unknown';
  if (today < date) return 'upcoming';
  // A pickup/sanitation visit dated today is being worked, not merely
  // "coming up" — there is no separate task evidence here to say otherwise.
  if (today === date) return 'active';
  return 'done';
}

/**
 * One status to represent however many tasks an order produced. Mirrors the
 * precedence used for lifecycle's task evidence so a point's badge and its
 * lifecycle never quietly disagree with each other.
 */
function summarizeTaskStatus(tasks: readonly Task[]): TaskStatus | null {
  if (tasks.length === 0) return null;
  if (tasks.every((task) => task.status === 'COMPLETED')) return 'COMPLETED';
  if (tasks.some((task) => task.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  return 'NEW';
}

// ---------------------------------------------------------------------------
// Order -> point
// ---------------------------------------------------------------------------

function groupTasksByOrder(tasks: readonly Task[]): Map<number, Task[]> {
  const map = new Map<number, Task[]>();
  for (const task of tasks) {
    if (!task.order) continue;
    const list = map.get(task.order.id);
    if (list) list.push(task);
    else map.set(task.order.id, [task]);
  }
  return map;
}

/**
 * Route assignment lives on `Task`, not on `Order` — so an order's route (and
 * the county that comes with it) is read off its own tasks. When those tasks
 * disagree about which route they are on (nothing in the schema prevents it),
 * neither field is guessed at: a wrong route badge is worse than a blank one.
 */
function resolveRouteAndCounty(orderTasks: readonly Task[]): {
  routeId: number | null;
  county: string | null;
} {
  const routes = new Map<number, Route>();
  for (const task of orderTasks) {
    if (task.route) routes.set(task.route.id, task.route);
  }
  if (routes.size !== 1) return { routeId: null, county: null };
  const [route] = [...routes.values()];
  return { routeId: route!.id, county: route!.county };
}

function orderQuantity(order: Order): number | null {
  switch (order.orderType) {
    case 'Amplasari':
      return order.quantity;
    case 'Ridicari':
      return order.pickupQuantity;
    case 'Igienizari':
      return null;
  }
}

function orderProductName(order: Order): string | null {
  switch (order.orderType) {
    case 'Amplasari':
      return order.product?.name ?? null;
    case 'Ridicari':
      return order.pickupProductName ?? order.product?.name ?? null;
    case 'Igienizari':
      return order.subscription?.name ?? null;
  }
}

interface DroppedOrder {
  orderId: number;
  orderNumber: number;
  clientName: string;
  address: string | null;
  reason: 'missing' | 'malformed';
}

/**
 * Builds the point for one order, or records why it could not be plotted.
 * Coordinates are the only hard requirement — everything else on a `MapPoint`
 * degrades to null rather than dropping the order, because a point with a
 * blank county is still worth showing on the map.
 */
function projectOrder(
  order: Order,
  orderTasks: readonly Task[],
  today: string,
): { point: MapPoint } | { dropped: DroppedOrder } {
  const raw = orderCoordinates(order);
  const parsed = parseCoordinates(raw);
  if (!parsed) {
    return {
      dropped: {
        orderId: order.id,
        orderNumber: order.number,
        clientName: clientName(order.client),
        address: orderAddress(order),
        // No string at all vs. a string parseCoordinates refused to accept —
        // the UI's data-quality callout treats these as different problems
        // (nothing was ever recorded vs. something was recorded wrong).
        reason: !raw || raw.trim().length === 0 ? 'missing' : 'malformed',
      },
    };
  }

  const { routeId, county } = resolveRouteAndCounty(orderTasks);

  return {
    point: {
      id: `order:${order.id}`,
      orderId: order.id,
      orderNumber: order.number,
      orderType: order.orderType,
      lifecycle: deriveLifecycle(order, orderTasks, today),
      lat: parsed.lat,
      lng: parsed.lng,
      clientId: order.client.id,
      clientName: clientName(order.client),
      address: orderAddress(order),
      county,
      date: orderPrimaryDate(order),
      quantity: orderQuantity(order),
      productName: orderProductName(order),
      taskIds: orderTasks.map((task) => task.id),
      taskStatus: summarizeTaskStatus(orderTasks),
      routeId,
      summary: orderSummary(order),
    },
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Diacritic-insensitive "does this point match" — folded once per point. */
function pointMatchesQuery(point: MapPoint, foldedNeedle: string): boolean {
  return [point.clientName, point.address, String(point.orderNumber)].some(
    (field) => field !== null && fold(field).includes(foldedNeedle),
  );
}

/**
 * An empty array/null/empty string means "no constraint" for that field —
 * every branch below is written so the default `MapFilters` is a no-op.
 */
function matchesFilters(point: MapPoint, filters: MapFilters, foldedNeedle: string): boolean {
  if (filters.orderTypes.length > 0 && !filters.orderTypes.includes(point.orderType)) {
    return false;
  }
  if (filters.lifecycles.length > 0 && !filters.lifecycles.includes(point.lifecycle)) {
    return false;
  }
  if (
    filters.counties.length > 0 &&
    (point.county === null || !filters.counties.includes(point.county))
  ) {
    return false;
  }
  if (
    filters.routeIds.length > 0 &&
    (point.routeId === null || !filters.routeIds.includes(point.routeId))
  ) {
    return false;
  }
  // A point with no anchor date cannot be confirmed inside a date range, so a
  // range filter excludes it — silently including it would misrepresent the
  // range the operator asked for.
  if (filters.from && (point.date === null || point.date < filters.from)) return false;
  if (filters.to && (point.date === null || point.date > filters.to)) return false;
  if (foldedNeedle && !pointMatchesQuery(point, foldedNeedle)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Cycles the palette by sorted route id, not by the order routes happen to
 * arrive in — so a route keeps the same colour across rebuilds even as other
 * routes are added, removed, or reordered upstream.
 */
function assignRouteColors(routes: readonly Route[]): Map<number, string> {
  const ids = [...new Set(routes.map((route) => route.id))].sort((left, right) => left - right);
  const colors = new Map<number, string>();
  ids.forEach((id, index) => {
    colors.set(id, ROUTE_PALETTE[index % ROUTE_PALETTE.length]!);
  });
  return colors;
}

function pathLengthKm(stops: readonly LatLng[]): number {
  let total = 0;
  for (let index = 1; index < stops.length; index += 1) {
    total += distanceKm(stops[index - 1]!, stops[index]!);
  }
  return total;
}

/**
 * A polyline needs two ends — a route with a single usable stop has nothing
 * to draw a line between, so it is left out of `MapData.routes` entirely
 * rather than rendered as a lone point (the point layer already shows it).
 */
function buildRouteLine(route: Route, color: string): MapRouteLine | null {
  const ordered = sortByOrderIndex(route.tasks);
  const stops: MapRouteStop[] = [];
  let droppedStops = 0;

  for (const task of ordered) {
    const point = parseCoordinates(task.coordinates);
    if (!point) {
      droppedStops += 1;
      continue;
    }
    stops.push({
      taskId: task.id,
      taskType: task.type,
      status: task.status,
      lat: point.lat,
      lng: point.lng,
      seq: stops.length + 1,
      label: task.clientName ?? task.address ?? `Oprire ${stops.length + 1}`,
      address: task.address,
    });
  }

  if (stops.length < 2) return null;

  return {
    routeId: route.id,
    label: routeLabel(route),
    dayOfWeek: route.dayOfWeek,
    county: route.county,
    driverName: route.employee?.fullName ?? null,
    color,
    stops,
    totalKm: pathLengthKm(stops),
    droppedStops,
    completed: route.tasks.filter((task) => task.status === 'COMPLETED').length,
    total: route.tasks.length,
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function sumQuantity(points: readonly MapPoint[]): number {
  return points.reduce((sum, point) => sum + (point.quantity ?? 0), 0);
}

/**
 * Fixed order (every lifecycle always present, even at zero) rather than
 * sorted by count — a legend that reorders itself every time a filter changes
 * the counts is harder to scan than one that stays put.
 */
function buildByLifecycle(points: readonly MapPoint[]): CountBucket[] {
  return LIFECYCLES.map((lifecycle) => {
    const subset = points.filter((point) => point.lifecycle === lifecycle);
    return {
      key: lifecycle,
      label: LIFECYCLE_LABEL[lifecycle],
      count: subset.length,
      quantity: sumQuantity(subset),
    };
  });
}

/**
 * `ORDER_TYPES` values ("Amplasari", "Ridicari", "Igienizari") are already
 * the Romanian domain nouns, not enum-speak, so they double as the label —
 * a prettier legend string is a UI concern, not this layer's.
 */
function buildByOrderType(points: readonly MapPoint[]): CountBucket[] {
  return ORDER_TYPES.map((type) => {
    const subset = points.filter((point) => point.orderType === type);
    return {
      key: type,
      label: type,
      count: subset.length,
      quantity: sumQuantity(subset),
    };
  });
}

function byQuantityThenCount(
  left: { quantity: number; count: number },
  right: { quantity: number; count: number },
): number {
  return right.quantity - left.quantity || right.count - left.count;
}

const NO_COUNTY_KEY = 'fara-judet';
const NO_COUNTY_LABEL = 'fără județ';

function buildByCounty(points: readonly MapPoint[]): CountBucket[] {
  const buckets = new Map<string, { label: string; count: number; quantity: number }>();
  for (const point of points) {
    const key = point.county ?? NO_COUNTY_KEY;
    const entry = buckets.get(key) ?? {
      label: point.county ?? NO_COUNTY_LABEL,
      count: 0,
      quantity: 0,
    };
    entry.count += 1;
    entry.quantity += point.quantity ?? 0;
    buckets.set(key, entry);
  }
  return [...buckets.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort(byQuantityThenCount);
}

const TOP_SITES_LIMIT = 8;
/**
 * ~11 m at this latitude. The backend stores coordinates as free-text
 * "lat,lng" strings with no fixed precision, so "44.4268,26.1025" and
 * "44.42681,26.10249" are the same physical site typed with one extra digit
 * of GPS noise — grouping on the raw float would silently split one site's
 * cabins into two rows in the stats panel. This is the same rounding gap that
 * `buildPacketGroups` (orderModel.ts) sidesteps by keying on the raw string
 * instead: here we actually need numeric proximity, so we round instead.
 */
const SITE_COORD_PRECISION = 4;

function roundCoord(value: number): number {
  const factor = 10 ** SITE_COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

function siteKey(lat: number, lng: number): string {
  return `${roundCoord(lat).toFixed(SITE_COORD_PRECISION)},${roundCoord(lng).toFixed(SITE_COORD_PRECISION)}`;
}

function buildTopSites(points: readonly MapPoint[]): MapStats['topSites'] {
  interface Accumulator {
    lat: number;
    lng: number;
    label: string;
    count: number;
    quantity: number;
  }
  const sites = new Map<string, Accumulator>();

  for (const point of points) {
    const key = siteKey(point.lat, point.lng);
    const existing = sites.get(key);
    if (existing) {
      existing.count += 1;
      existing.quantity += point.quantity ?? 0;
      continue;
    }
    sites.set(key, {
      lat: roundCoord(point.lat),
      lng: roundCoord(point.lng),
      // First order seen at this site names it — arbitrary when addresses
      // genuinely differ at the same spot, but deterministic for one build.
      label: point.address ?? point.clientName,
      count: 1,
      quantity: point.quantity ?? 0,
    });
  }

  return [...sites.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort(byQuantityThenCount)
    .slice(0, TOP_SITES_LIMIT);
}

function computeBounds(points: readonly MapPoint[]): MapBounds | null {
  if (points.length === 0) return null;
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  return { west, south, east, north };
}

function buildStats(
  points: readonly MapPoint[],
  droppedCount: number,
  routes: readonly MapRouteLine[],
  unassignedTasks: number,
): MapStats {
  const plotted = points.length;
  const total = plotted + droppedCount;
  return {
    plotted,
    dropped: droppedCount,
    droppedRatio: total === 0 ? 0 : droppedCount / total,
    totalQuantity: sumQuantity(points),
    byLifecycle: buildByLifecycle(points),
    byOrderType: buildByOrderType(points),
    byCounty: buildByCounty(points),
    topSites: buildTopSites(points),
    routes: {
      count: routes.length,
      totalKm: routes.reduce((sum, route) => sum + route.totalKm, 0),
      stops: routes.reduce((sum, route) => sum + route.stops.length, 0),
      unassignedTasks,
    },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildMapData(input: {
  orders: readonly Order[];
  tasks: readonly Task[];
  routes: readonly Route[];
  filters: MapFilters;
  /** "today" as ISO YYYY-MM-DD. Injected so tests are deterministic. */
  today: string;
}): MapData {
  const { orders, tasks, routes, filters, today } = input;
  const tasksByOrder = groupTasksByOrder(tasks);

  const points: MapPoint[] = [];
  const droppedOrders: DroppedOrder[] = [];

  for (const order of orders) {
    const orderTasks = tasksByOrder.get(order.id) ?? [];
    const projected = projectOrder(order, orderTasks, today);
    if ('point' in projected) points.push(projected.point);
    else droppedOrders.push(projected.dropped);
  }

  // Dropped orders are a data-quality signal over everything passed in, not
  // over whatever the operator currently has the map filtered to — an order
  // with garbage coordinates is a problem worth surfacing regardless of which
  // lifecycle or county is on screen right now. `MapFilters` therefore only
  // ever narrows `points`.
  const foldedNeedle = fold(filters.query.trim());
  const filteredPoints = points.filter((point) => matchesFilters(point, filters, foldedNeedle));

  const routeColors = assignRouteColors(routes);
  const routeLines = routes
    .map((route) => buildRouteLine(route, routeColors.get(route.id)!))
    .filter((line): line is MapRouteLine => line !== null);

  const unassignedTasks = tasks.filter(isUnassigned).length;

  return {
    points: filteredPoints,
    routes: routeLines,
    stats: buildStats(filteredPoints, droppedOrders.length, routeLines, unassignedTasks),
    droppedOrders,
    bounds: computeBounds(filteredPoints),
  };
}
