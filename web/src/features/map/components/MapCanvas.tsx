/**
 * MapLibre rendering layer. Knows nothing about `Order`, `Task` or `Route` —
 * everything it needs comes through `MapPoint` / `MapRouteLine` from
 * `../types`, which is what lets this be re-pointed at a different data
 * source without touching a layer definition (see the header of `types.ts`).
 *
 * The `maplibregl.Map` instance is created exactly once, in a mount-only
 * effect, and never rebuilt: every prop after that is applied to the live
 * map via `setData` / `setPaintProperty` / `setLayoutProperty`. That is the
 * whole performance story here — rebuilding sources or layers on every
 * filter change would mean re-uploading geometry to the GPU and re-triggering
 * layout on every keystroke in the sidebar search box.
 *
 * Every effect that touches the map after mount checks `ready` (flipped once
 * on `'load'`) and `map.isStyleLoaded()` before calling anything — MapLibre
 * throws synchronously if you touch a layer before the style has finished
 * loading, and in React 19 StrictMode the mount effect runs, cleans up, and
 * runs again before any of this settles.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { AttributionControl, Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './mapCanvas.css';
import { Button, cx, EmptyState } from '@/components/ui';
import { DEFAULT_VIEW, type MapBounds, type MapPoint, type MapRouteLine } from '../types';
import {
  pointsToFeatureCollection,
  routesToLineFeatureCollection,
  routesToStopFeatureCollection,
  selectedPointFeatureCollection,
  type PointProperties,
} from './geo';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  INTERACTIVE_LAYERS,
  LAYER_CLUSTER,
  LAYER_HEATMAP,
  LAYER_POINT,
  LAYER_STOP_CIRCLE,
  MAP_STYLE_URL,
  ROUTE_LAYERS,
  SOURCE_HEAT,
  SOURCE_POINTS,
  SOURCE_ROUTES,
  SOURCE_SELECTED,
  SOURCE_STOPS,
  clusterCountLayer,
  clusterLayer,
  heatmapLayer,
  pointColorExpression,
  pointLayer,
  routeCasingLayer,
  routeLineLayer,
  selectedRingLayer,
  stopCircleLayer,
  stopLabelLayer,
  styleValue,
} from './mapStyle';
import { MapControls } from './MapControls';
import { MapLegend } from './MapLegend';
import { HoverCard } from './HoverCard';

export interface MapCanvasProps {
  points: readonly MapPoint[];
  routes: readonly MapRouteLine[];
  /** How to colour the points. */
  colorBy: 'orderType' | 'lifecycle';
  /** Extra density layer under the points. */
  showHeatmap: boolean;
  /** Draw route polylines + numbered stop badges. */
  showRoutes: boolean;
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  /** Fit the viewport to these bounds when they change. */
  bounds: MapBounds | null;
  className?: string;
}

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const FIT_PADDING = 64;

function emptyBoundsEqual(a: MapBounds | null, b: MapBounds | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north;
}

export function MapCanvas({
  points,
  routes,
  colorBy,
  showHeatmap,
  showRoutes,
  selectedPointId,
  onSelectPoint,
  bounds,
  className,
}: MapCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const appliedBoundsRef = useRef<MapBounds | null>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Bumped by the retry button to tear the map down and build a fresh one. */
  const [retryKey, setRetryKey] = useState(0);
  const [hover, setHover] = useState<{ point: PointProperties; x: number; y: number } | null>(null);

  // The map is created once; interaction handlers registered at that point
  // close over whatever `onSelectPoint` was at mount time. A ref keeps them
  // reading the latest callback without making the mount effect depend on it.
  const onSelectPointRef = useRef(onSelectPoint);
  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  const pointsGeoJSON = useMemo(() => pointsToFeatureCollection(points), [points]);
  const routeLinesGeoJSON = useMemo(() => routesToLineFeatureCollection(routes), [routes]);
  const routeStopsGeoJSON = useMemo(() => routesToStopFeatureCollection(routes), [routes]);
  const selectedGeoJSON = useMemo(
    () => selectedPointFeatureCollection(points, selectedPointId),
    [points, selectedPointId],
  );

  // ── Mount once: create the map, wire sources/layers/interaction on 'load'. ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let loaded = false;

    // React 19 StrictMode mounts, cleans up, then mounts again. `failed` and
    // `ready` are component state, so they survive that teardown — reset them
    // here or a first attempt that tripped leaves the second attempt showing
    // an error screen over a perfectly good map.
    setFailed(false);
    setReady(false);

    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude],
      zoom: DEFAULT_VIEW.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;

    // A flat operational dashboard, not an exploration map — rotation buys
    // nothing here and only risks a dispatcher landing on a disorienting
    // tilted view by accident.
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    // NOT compact. Compact mode collapses attribution to an "i" button and
    // hides the credit text behind it (.maplibregl-compact .…-attrib-inner
    // { display:none }), and mapCanvas.css hides that button to keep the
    // chrome clean — the two together made the OpenFreeMap/OSM credit
    // unreachable, which its licence does not allow. Expanded is also only
    // one short line at this size.
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right');

    const subscriptions: { unsubscribe: () => void }[] = [];

    // The only path to the failure screen. Generous, because it now has to be
    // certain: a cold vector-tile cache over a slow connection can legitimately
    // take a while, and showing "no internet" to someone whose map is simply
    // still arriving is worse than making them wait.
    const loadTimeout = setTimeout(() => {
      if (!loaded && !cancelled) setFailed(true);
    }, 20_000);

    subscriptions.push(
      map.on('error', (event) => {
        // Never fail the canvas from here. MapLibre emits `error` for entirely
        // routine things during startup — a single 404 raster tile outside the
        // Natural Earth coverage, a sprite or glyph range that 304s oddly, an
        // AbortError for tiles cancelled as the camera settles. Treating any
        // of those as fatal is what put a permanent "check your internet"
        // screen over a tile host that was answering 200 the whole time.
        //
        // A genuinely unreachable style never reaches `'load'`, and the
        // timeout above is what catches that — it cannot false-positive.
        if (!cancelled) console.warn('[map] non-fatal MapLibre error', event.error ?? event);
      }),
    );

    map.once('load', () => {
      if (cancelled) return;
      loaded = true;
      clearTimeout(loadTimeout);
      setFailed(false);

      map.addSource(SOURCE_POINTS, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
      });
      // Kept separate from the clustered source above: a clustered feature
      // loses its per-order `quantity`, and the heatmap needs the real value
      // to weight density correctly at every zoom, not just the ones where
      // superclustering happens to have expanded down to individual points.
      map.addSource(SOURCE_HEAT, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
      map.addSource(SOURCE_ROUTES, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
      map.addSource(SOURCE_STOPS, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
      map.addSource(SOURCE_SELECTED, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });

      // Bottom to top: density under everything, routes under the markers
      // that sit on them, clusters/points/selection ring on top.
      map.addLayer(heatmapLayer());
      map.addLayer(routeCasingLayer());
      map.addLayer(routeLineLayer());
      map.addLayer(stopCircleLayer());
      map.addLayer(stopLabelLayer());
      map.addLayer(clusterLayer());
      map.addLayer(clusterCountLayer());
      map.addLayer(pointLayer(colorBy));
      map.addLayer(selectedRingLayer());

      map.setLayoutProperty(LAYER_HEATMAP, 'visibility', showHeatmap ? 'visible' : 'none');
      const routeVisibility = showRoutes ? 'visible' : 'none';
      for (const layerId of ROUTE_LAYERS) map.setLayoutProperty(layerId, 'visibility', routeVisibility);

      subscriptions.push(
        map.on('click', LAYER_CLUSTER, (event) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id as number | undefined;
          const source = map.getSource<GeoJSONSource>(SOURCE_POINTS);
          if (clusterId === undefined || !source || feature?.geometry.type !== 'Point') return;
          const center = feature.geometry.coordinates as [number, number];
          source
            .getClusterExpansionZoom(clusterId)
            .then((zoom) => map.easeTo({ center, zoom, duration: 500 }))
            .catch(() => {
              // Stale tile / offline lookup — the cluster just stays put.
            });
        }),
      );

      subscriptions.push(
        map.on('click', LAYER_POINT, (event) => {
          const id = event.features?.[0]?.properties?.id as string | undefined;
          if (id) onSelectPointRef.current(id);
        }),
      );

      subscriptions.push(
        map.on('click', (event) => {
          const hits = map.queryRenderedFeatures(event.point, {
            layers: [LAYER_CLUSTER, LAYER_POINT, LAYER_STOP_CIRCLE],
          });
          if (hits.length === 0) onSelectPointRef.current(null);
        }),
      );

      for (const layerId of INTERACTIVE_LAYERS) {
        subscriptions.push(
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          }),
        );
        subscriptions.push(
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
          }),
        );
      }

      subscriptions.push(
        map.on('mousemove', LAYER_POINT, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          setHover({
            point: feature.properties as unknown as PointProperties,
            x: event.point.x,
            y: event.point.y,
          });
        }),
      );
      subscriptions.push(map.on('mouseleave', LAYER_POINT, () => setHover(null)));

      setReady(true);
    });

    // MapLibre measures the container ONCE, when the Map is constructed, and
    // sizes its WebGL canvas from that. This canvas lives in a flex column
    // (main > page > row > flex-1), so at construction time the container can
    // still be 0 high — and MapLibre never re-measures on its own. The result
    // is a live, loaded, correctly-styled map rendering into a 0x0 canvas:
    // controls and legend appear (they are absolutely-positioned React nodes)
    // over a blank rectangle. An observer is the only reliable fix; a
    // one-shot resize after load races the same layout pass.
    const resizeObserver = new ResizeObserver(() => {
      if (!cancelled) map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      resizeObserver.disconnect();
      for (const subscription of subscriptions) subscription.unsubscribe();
      map.remove();
      mapRef.current = null;
    };
    // Mount + explicit retry only. Every PROP change is pushed onto the live
    // map instead of re-running this effect (see the file header); `retryKey`
    // is the one thing that rebuilds it, and it reuses the teardown above
    // rather than needing a page reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // ── Colour, independent of the source: a `setPaintProperty` swap, not a rebuild. ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    map.setPaintProperty(LAYER_POINT, 'circle-color', styleValue(pointColorExpression(colorBy)));
  }, [colorBy, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    map.setLayoutProperty(LAYER_HEATMAP, 'visibility', showHeatmap ? 'visible' : 'none');
  }, [showHeatmap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const visibility = showRoutes ? 'visible' : 'none';
    for (const layerId of ROUTE_LAYERS) map.setLayoutProperty(layerId, 'visibility', visibility);
  }, [showRoutes, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    map.getSource<GeoJSONSource>(SOURCE_POINTS)?.setData(pointsGeoJSON);
    map.getSource<GeoJSONSource>(SOURCE_HEAT)?.setData(pointsGeoJSON);
  }, [pointsGeoJSON, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    map.getSource<GeoJSONSource>(SOURCE_ROUTES)?.setData(routeLinesGeoJSON);
    map.getSource<GeoJSONSource>(SOURCE_STOPS)?.setData(routeStopsGeoJSON);
  }, [routeLinesGeoJSON, routeStopsGeoJSON, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    map.getSource<GeoJSONSource>(SOURCE_SELECTED)?.setData(selectedGeoJSON);
  }, [selectedGeoJSON, ready]);

  // `bounds` gets a fresh object from `data.ts` on every recompute even when
  // its four numbers are unchanged (see `useStableBounds` in MapPage); the
  // value comparison here is what stops that from re-fitting the viewport —
  // and stealing the camera back from an operator mid-pan — on every refetch.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !bounds) return;
    if (emptyBoundsEqual(appliedBoundsRef.current, bounds)) return;
    appliedBoundsRef.current = bounds;
    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: FIT_PADDING, duration: 800, maxZoom: 15 },
    );
  }, [bounds, ready]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 250 });
  };

  const fitToBounds = () => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    appliedBoundsRef.current = bounds;
    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: FIT_PADDING, duration: 600, maxZoom: 15 },
    );
  };

  const hasPoints = points.length > 0;

  return (
    <div className={cx('relative overflow-hidden rounded-lg bg-surface-sunken', className)}>
      {/*
        Inline positioning, not Tailwind's `absolute inset-0`.

        MapLibre stamps its own `.maplibregl-map` class onto whatever element
        you hand it, and maplibre-gl.css declares `position: relative` on that
        class. Loaded after Tailwind's utilities, it wins — so the container
        silently becomes `position: relative`, `inset-0` stops applying, the
        div collapses to height 0, and MapLibre initialises a zero-height
        viewport. It then needs no tiles, never finishes loading, and shows a
        blank canvas with no error anywhere. Inline styles outrank both
        stylesheets, so this cannot be undone by class ordering.
      */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {ready && !failed && (
        <>
          <MapControls onZoomIn={() => zoomBy(1)} onZoomOut={() => zoomBy(-1)} onFit={fitToBounds} fitDisabled={!bounds} />
          <MapLegend colorBy={colorBy} showHeatmap={showHeatmap} showRoutes={showRoutes} hasRoutes={routes.length > 0} />
        </>
      )}

      {hover && <HoverCard point={hover.point} x={hover.x} y={hover.y} />}

      {ready && !failed && !hasPoints && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto rounded-lg bg-white/95 shadow-popover ring-1 ring-border ring-inset">
            <EmptyState
              size="sm"
              title="Nicio comandă de afișat pe hartă"
              body="Comenzile apar aici de îndată ce au coordonate valide."
            />
          </div>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken p-6">
          <EmptyState
            size="sm"
            title="Harta nu a putut fi încărcată"
            body="Fondul de hartă nu a răspuns. Datele comenzilor sunt încărcate — doar stratul cartografic lipsește."
            action={
              <Button variant="secondary" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
                Reîncearcă
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
