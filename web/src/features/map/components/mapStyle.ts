/**
 * Static MapLibre wiring: source/layer ids, the tile style, and every
 * paint/layout object this canvas draws. Split out of MapCanvas.tsx so that
 * file reads as lifecycle + orchestration, not a wall of style JSON.
 *
 * MapLibre's paint/layout property types are exact, hand-written discriminated
 * unions over expression tuples of unbounded arity — accurate for someone
 * typing a style by hand, but they defeat literal inference for anything
 * assembled programmatically (a `match` built from a `Record`, a `step` built
 * from a palette array). `styleValue` bridges through `never` — the bottom
 * type, assignable to anything — at the handful of call sites that hand a
 * plain object to the MapLibre API. It is a narrow, deliberate escape hatch,
 * not `any`: every value on the way in is still fully typed, and the cast is
 * one line instead of a fight with the union at every expression.
 */

import type { AddLayerObject } from 'maplibre-gl';
import type { OrderTypeTag } from '@/types/domain';
import { LIFECYCLE_COLOR, ORDER_TYPE_COLOR, type Lifecycle } from '../types';

export function styleValue<T>(value: unknown): T {
  return value as never;
}

/**
 * OpenFreeMap's hosted styles: free vector tiles, no API key, no signup, no
 * billing surprise. The production path once external dependencies matter (an
 * outage on tiles.openfreemap.org, or "zero third parties") is self-hosted
 * Protomaps `.pmtiles` behind our own CDN — that swap is these two constants,
 * nothing else in this module changes.
 *
 * **The basemap follows the app theme (TODO-66).** It used to be `liberty` in
 * both, so dark mode put a bright white-and-green sheet inside an otherwise
 * dark app — made worse, not better, by the overlay sweep that moved the legend
 * and hover card onto `bg-surface/95`: a dark card floating on a light map.
 *
 * The alternative was to keep it light on purpose, and it is a real argument —
 * a light basemap is easier to read outdoors, and the pin colours were picked
 * against white. It loses: this is a dispatcher's desk screen far more often
 * than a phone in daylight, and every other surface in the app already honours
 * the choice the user made. `dark` is OpenFreeMap's own variant, a near-black
 * ground (`rgb(12,12,12)`) with the same layer vocabulary as `liberty`, so the
 * overlay layers below need no per-theme variants of their own.
 */
export const MAP_STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export function mapStyleUrl(scheme: 'light' | 'dark'): string {
  return MAP_STYLE_URLS[scheme];
}

export const SOURCE_POINTS = 'ecotrack-points';
export const SOURCE_HEAT = 'ecotrack-points-heat';
export const SOURCE_ROUTES = 'ecotrack-routes';
export const SOURCE_STOPS = 'ecotrack-route-stops';
export const SOURCE_SELECTED = 'ecotrack-selected';

export const LAYER_HEATMAP = 'ecotrack-heatmap';
export const LAYER_ROUTE_CASING = 'ecotrack-route-casing';
export const LAYER_ROUTE_LINE = 'ecotrack-route-line';
export const LAYER_STOP_CIRCLE = 'ecotrack-stop-circle';
export const LAYER_STOP_LABEL = 'ecotrack-stop-label';
export const LAYER_CLUSTER = 'ecotrack-cluster';
export const LAYER_CLUSTER_COUNT = 'ecotrack-cluster-count';
export const LAYER_POINT = 'ecotrack-point';
export const LAYER_SELECTED_RING = 'ecotrack-selected-ring';

/** Route layers toggled together by `showRoutes`. */
export const ROUTE_LAYERS = [LAYER_ROUTE_CASING, LAYER_ROUTE_LINE, LAYER_STOP_CIRCLE, LAYER_STOP_LABEL] as const;

/** Layers a click/hover can land on. */
export const INTERACTIVE_LAYERS = [LAYER_CLUSTER, LAYER_POINT, LAYER_STOP_CIRCLE] as const;

export const CLUSTER_MAX_ZOOM = 14;
export const CLUSTER_RADIUS = 48;

// Brand ramp, duplicated as literal hex rather than imported from index.css —
// see the note on ORDER_TYPE_COLOR in types.ts: paint properties run on the
// GL thread and cannot read CSS custom properties.
const BRAND_300 = '#8db0d6';
const BRAND_500 = '#2c5a8f';
const BRAND_700 = '#16283c';
const NEUTRAL_FALLBACK = '#94a3b8';

function matchColorExpression(property: string, colors: Record<string, string>): unknown[] {
  const expression: unknown[] = ['match', ['get', property]];
  for (const [key, color] of Object.entries(colors)) expression.push(key, color);
  expression.push(NEUTRAL_FALLBACK);
  return expression;
}

/** Data-driven `circle-color`, swapped with `setPaintProperty` — never a source rebuild. */
export function pointColorExpression(colorBy: 'orderType' | 'lifecycle'): unknown[] {
  return colorBy === 'orderType'
    ? matchColorExpression('orderType', ORDER_TYPE_COLOR as Record<OrderTypeTag, string>)
    : matchColorExpression('lifecycle', LIFECYCLE_COLOR as Record<Lifecycle, string>);
}

export function clusterLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_CLUSTER,
    type: 'circle',
    source: SOURCE_POINTS,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], BRAND_300, 10, BRAND_500, 50, BRAND_700],
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.94,
    },
  });
}

export function clusterCountLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_CLUSTER_COUNT,
    type: 'symbol',
    source: SOURCE_POINTS,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
      'text-size': 12,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });
}

export function pointLayer(colorBy: 'orderType' | 'lifecycle'): AddLayerObject {
  return styleValue({
    id: LAYER_POINT,
    type: 'circle',
    source: SOURCE_POINTS,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 14, 7.5],
      'circle-color': pointColorExpression(colorBy),
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.95,
    },
  });
}

export function selectedRingLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_SELECTED_RING,
    type: 'circle',
    source: SOURCE_SELECTED,
    paint: {
      'circle-radius': 13,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-width': 3,
      'circle-stroke-color': BRAND_700,
      'circle-stroke-opacity': 0.9,
    },
  });
}

/**
 * Weighted by quantity, defaulting to 1 for the (rare) order with no cabin
 * count — an unknown quantity should still register as "a job happened here",
 * not vanish from the density picture.
 *
 * `heatmap-opacity` fades out by zoom 13: past that point individual points
 * and clusters are legible on their own, and a dense heatmap under them just
 * muddies the basemap.
 */
export function heatmapLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_HEATMAP,
    type: 'heatmap',
    source: SOURCE_HEAT,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'quantity'], 1], 0, 0.15, 1, 0.4, 5, 0.75, 20, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 2.5],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(22,40,60,0)',
        0.2, 'rgba(141,176,214,0.5)',
        0.4, BRAND_500,
        0.7, '#d97706',
        1, '#dc2626',
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 9, 24, 15, 40],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, 13, 0.15],
    },
  });
}

/**
 * Wide, low-contrast line under the colour so overlapping routes stay
 * separable.
 *
 * **"Low-contrast" is relative to the ground, so this follows the theme
 * (TODO-66).** White is a quiet separator on the light basemap and the loudest
 * thing on screen against the dark one's `rgb(12,12,12)` — several routes
 * sharing a corridor merged into one bright rope, with the colours that
 * identify them reduced to a thin core. Near-black restores the intent: it
 * still breaks an overlapping line where one crosses another, without
 * competing with the line it exists to support.
 *
 * The point and cluster strokes below stay white in both themes on purpose —
 * their job is the opposite one, making a small mark pop off the ground, and
 * white does that in both.
 */
export function routeCasingLayer(scheme: 'light' | 'dark'): AddLayerObject {
  return styleValue({
    id: LAYER_ROUTE_CASING,
    type: 'line',
    source: SOURCE_ROUTES,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': scheme === 'dark' ? '#05070a' : '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 14, 8],
      'line-opacity': 0.85,
    },
  });
}

export function routeLineLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_ROUTE_LINE,
    type: 'line',
    source: SOURCE_ROUTES,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 14, 4],
      'line-opacity': 0.95,
    },
  });
}

/**
 * Filled disc in the route colour for a completed stop, hollow (white,
 * coloured ring) for a pending one — a shape difference reads at a glance
 * even for the significant fraction of dispatchers who are colour-blind to
 * the route palette itself.
 */
export function stopCircleLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_STOP_CIRCLE,
    type: 'circle',
    source: SOURCE_STOPS,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 10],
      'circle-color': ['case', ['==', ['get', 'status'], 'COMPLETED'], ['get', 'color'], '#ffffff'],
      'circle-stroke-width': 2,
      'circle-stroke-color': ['get', 'color'],
      'circle-opacity': 0.98,
    },
  });
}

export function stopLabelLayer(): AddLayerObject {
  return styleValue({
    id: LAYER_STOP_LABEL,
    type: 'symbol',
    source: SOURCE_STOPS,
    layout: {
      'text-field': ['case', ['==', ['get', 'status'], 'COMPLETED'], '✓', ['to-string', ['get', 'seq']]],
      'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
      'text-size': 10,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': ['case', ['==', ['get', 'status'], 'COMPLETED'], '#ffffff', ['get', 'color']],
    },
  });
}
