/**
 * MapPoint / MapRouteLine → GeoJSON. Pure and side-effect free on purpose: the
 * canvas calls these inside `useMemo`, so a stable reference in means a stable
 * reference out, and `source.setData()` is skipped whenever the underlying
 * arrays haven't actually changed.
 *
 * Property bags are kept flat and JSON-primitive (`string | number | null`) —
 * these cross into MapLibre's GL-thread expression evaluator, which cannot see
 * class instances or nested objects the way `paint`/`filter` expressions read
 * them with `['get', ...]`.
 */

import type { OrderTypeTag, TaskStatus, TaskType } from '@/types/domain';
import type { Lifecycle, MapPoint, MapRouteLine } from '../types';

export interface PointProperties {
  id: string;
  orderId: number;
  orderNumber: number;
  orderType: OrderTypeTag;
  lifecycle: Lifecycle;
  quantity: number | null;
  clientName: string;
  address: string | null;
  county: string | null;
  date: string | null;
  productName: string | null;
  taskStatus: TaskStatus | null;
  routeId: number | null;
  summary: string;
}

export interface RouteLineProperties {
  routeId: number;
  label: string;
  color: string;
  completed: number;
  total: number;
}

export interface RouteStopProperties {
  routeId: number;
  taskId: number;
  seq: number;
  label: string;
  address: string | null;
  status: TaskStatus;
  taskType: TaskType;
  color: string;
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function pointsToFeatureCollection(
  points: readonly MapPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point, PointProperties> {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: {
        id: point.id,
        orderId: point.orderId,
        orderNumber: point.orderNumber,
        orderType: point.orderType,
        lifecycle: point.lifecycle,
        quantity: point.quantity,
        clientName: point.clientName,
        address: point.address,
        county: point.county,
        date: point.date,
        productName: point.productName,
        taskStatus: point.taskStatus,
        routeId: point.routeId,
        summary: point.summary,
      },
    })),
  };
}

/**
 * One LineString per route, in stop order. A route with fewer than two usable
 * stops has nothing to draw a line *through* — `MapRouteLine.stops` already
 * excludes stops with no coordinates (see `droppedStops` in types.ts), so this
 * is the single-stop-route case, not a data-quality one.
 */
export function routesToLineFeatureCollection(
  routes: readonly MapRouteLine[],
): GeoJSON.FeatureCollection<GeoJSON.LineString, RouteLineProperties> {
  const features: GeoJSON.Feature<GeoJSON.LineString, RouteLineProperties>[] = [];
  for (const route of routes) {
    const stops = [...route.stops].sort((a, b) => a.seq - b.seq);
    if (stops.length < 2) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: stops.map((stop) => [stop.lng, stop.lat]) },
      properties: {
        routeId: route.routeId,
        label: route.label,
        color: route.color,
        completed: route.completed,
        total: route.total,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function routesToStopFeatureCollection(
  routes: readonly MapRouteLine[],
): GeoJSON.FeatureCollection<GeoJSON.Point, RouteStopProperties> {
  const features: GeoJSON.Feature<GeoJSON.Point, RouteStopProperties>[] = [];
  for (const route of routes) {
    for (const stop of route.stops) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
        properties: {
          routeId: route.routeId,
          taskId: stop.taskId,
          seq: stop.seq,
          label: stop.label,
          address: stop.address,
          status: stop.status,
          taskType: stop.taskType,
          color: route.color,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Zero or one feature — the ring layer this feeds is filtered by `has no data` implicitly by being empty. */
export function selectedPointFeatureCollection(
  points: readonly MapPoint[],
  selectedId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }> {
  if (!selectedId) return EMPTY_COLLECTION as GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>;
  const point = points.find((candidate) => candidate.id === selectedId);
  if (!point) return EMPTY_COLLECTION as GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
        properties: { id: point.id },
      },
    ],
  };
}
