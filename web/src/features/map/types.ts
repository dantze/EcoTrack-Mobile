/**
 * The seam between the map's data layer and its rendering layer.
 *
 * `data.ts` turns domain records into these shapes; `components/MapCanvas.tsx`
 * renders them and knows nothing about `Order`, `Task` or `Route`. Neither side
 * imports the other — everything they share is in this file. That is what lets
 * the projection be unit-tested with no WebGL, and the canvas be re-pointed at
 * a different source without touching a layer definition.
 *
 * Coordinates arrive from the backend as `"lat,lng"` STRINGS on five different
 * entities and are optional everywhere (`parseCoordinates` in `@/types/domain`
 * returns null on anything malformed). Both sides here take already-parsed
 * numbers, and `MapData.dropped` carries the records that had nothing usable —
 * surfacing that count is deliberate, because a map that silently omits a
 * third of the work looks complete and is worse than no map at all.
 */

import type { OrderTypeTag, TaskStatus, TaskType } from '@/types/domain';

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/**
 * Where an order sits in its life, derived in `data.ts` from the order's own
 * dates and the status of the tasks generated from it. This is the axis the
 * "incoming vs done" views are built on, not a field the backend stores.
 */
export type Lifecycle =
  /** Scheduled, hasn't started. */
  | 'upcoming'
  /** Cabins are on site now / work is under way. */
  | 'active'
  /** Finished — picked up, or every task completed. */
  | 'done'
  /** Past its date with work still open. The queue that actually needs a human. */
  | 'overdue'
  /** Not enough dates to say. */
  | 'unknown';

export const LIFECYCLES: readonly Lifecycle[] = [
  'upcoming',
  'active',
  'overdue',
  'done',
  'unknown',
];

/** One plottable order. `id` is stable across rebuilds so selection survives a refetch. */
export interface MapPoint {
  /** `order:<id>`. */
  id: string;
  orderId: number;
  orderNumber: number;
  orderType: OrderTypeTag;
  lifecycle: Lifecycle;
  lat: number;
  lng: number;
  clientId: number;
  clientName: string;
  address: string | null;
  county: string | null;
  /** ISO date the order is anchored to (start/pickup/sanitation). */
  date: string | null;
  /** Cabins involved, when the order type has a quantity. */
  quantity: number | null;
  productName: string | null;
  /** Tasks generated from this order, if any are loaded. */
  taskIds: readonly number[];
  taskStatus: TaskStatus | null;
  /** Route this order's work sits on, when exactly one owns it. */
  routeId: number | null;
  /** One-line summary for the hover card. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export interface MapRouteStop {
  taskId: number;
  taskType: TaskType;
  status: TaskStatus;
  lat: number;
  lng: number;
  /** 1-based position as the driver drives it. */
  seq: number;
  label: string;
  address: string | null;
}

/** A route drawn as an ordered polyline through the stops that have coordinates. */
export interface MapRouteLine {
  routeId: number;
  label: string;
  date: string | null;
  county: string | null;
  driverName: string | null;
  /** Stable per-route colour, assigned in `data.ts` so legend and line agree. */
  color: string;
  stops: readonly MapRouteStop[];
  /** Straight-line path length. NOT driving distance — say so in the UI. */
  totalKm: number;
  /** Stops on this route that had no usable coordinates and are not drawn. */
  droppedStops: number;
  completed: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface CountBucket {
  key: string;
  label: string;
  count: number;
  /** Cabins, where the order type carries a quantity. */
  quantity: number;
}

export interface MapStats {
  /** Points that survived filtering and are on screen-eligible. */
  plotted: number;
  /** Orders in scope that could not be plotted. Show this. */
  dropped: number;
  /** dropped / (plotted + dropped), 0..1. */
  droppedRatio: number;
  totalQuantity: number;
  byLifecycle: readonly CountBucket[];
  byOrderType: readonly CountBucket[];
  byCounty: readonly CountBucket[];
  /** Busiest sites, most cabins first. Capped by the builder. */
  topSites: readonly {
    key: string;
    label: string;
    lat: number;
    lng: number;
    count: number;
    quantity: number;
  }[];
  routes: {
    count: number;
    totalKm: number;
    stops: number;
    unassignedTasks: number;
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface MapFilters {
  orderTypes: readonly OrderTypeTag[];
  lifecycles: readonly Lifecycle[];
  counties: readonly string[];
  /** Inclusive ISO date bounds on the point's anchor date. */
  from: string | null;
  to: string | null;
  /** Diacritic-insensitive free text over client, address, number. */
  query: string;
  /** Only orders whose work sits on one of these routes. Empty = no constraint. */
  routeIds: readonly number[];
}

export const EMPTY_FILTERS: MapFilters = {
  orderTypes: [],
  lifecycles: [],
  counties: [],
  from: null,
  to: null,
  query: '',
  routeIds: [],
};

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export interface MapData {
  points: readonly MapPoint[];
  routes: readonly MapRouteLine[];
  stats: MapStats;
  /** Orders with no usable coordinates, for the data-quality callout. */
  droppedOrders: readonly {
    orderId: number;
    orderNumber: number;
    clientName: string;
    address: string | null;
    reason: 'missing' | 'malformed';
  }[];
  /** Bounding box of `points`, or null when there is nothing to fit. */
  bounds: MapBounds | null;
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// ---------------------------------------------------------------------------
// Shared visual language
// ---------------------------------------------------------------------------

/**
 * Single source of truth for colour, so the legend, the markers, the stat rail
 * and the route lines cannot drift apart. Values are plain hex because MapLibre
 * paint properties are evaluated outside the DOM and cannot read CSS variables.
 */
export const ORDER_TYPE_COLOR: Record<OrderTypeTag, string> = {
  Amplasari: '#2563eb',
  Ridicari: '#f97316',
  Igienizari: '#0d9488',
};

export const LIFECYCLE_COLOR: Record<Lifecycle, string> = {
  upcoming: '#8b5cf6',
  active: '#2563eb',
  overdue: '#dc2626',
  done: '#64748b',
  unknown: '#94a3b8',
};

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  upcoming: 'Programate',
  active: 'În desfășurare',
  overdue: 'Întârziate',
  done: 'Finalizate',
  unknown: 'Fără dată',
};

/** Cycled per route so adjacent routes stay distinguishable. */
export const ROUTE_PALETTE: readonly string[] = [
  '#2563eb',
  '#f97316',
  '#0d9488',
  '#8b5cf6',
  '#db2777',
  '#65a30d',
  '#0891b2',
  '#ca8a04',
];

/** Romania, comfortably framed — the fallback when there is nothing to fit. */
export const DEFAULT_VIEW = { longitude: 25.0, latitude: 45.9, zoom: 6.2 } as const;
