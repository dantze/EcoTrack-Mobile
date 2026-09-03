/**
 * Map picker for an order's location (TODO-10).
 *
 * The only order location picker there is. It had a counterpart in mobile,
 * which TODO-33 deleted along with the rest of the Sales section — office
 * staff use this app on their phone. Interaction model: **click anywhere on
 * the map to drop
 * the pin, drag the pin to fine-tune it.** The pin is a real marker pinned to
 * the ground, not a crosshair fixed to the middle of the viewport — panning the
 * map moves the view, not the point, so the operator can look around without
 * losing the spot they already chose.
 *
 * Three things fill the value, in the order an operator reaches for them:
 *   1. a known place — somewhere this client (or anyone) has been served
 *      before, drawn as a numbered marker. Exact coordinates, zero typing.
 *   2. an address search, which flies the map to the result and drops the pin
 *      on it.
 *   3. clicking or dragging on the map, which reverse-geocodes a label for the
 *      new point.
 *
 * A hand-placed pin overwrites the address label on purpose. An address that no
 * longer matches its coordinates is worse than no address at all: the point is
 * what the driver navigates to, and the text is what the office reads to check
 * the point is right. They have to agree.
 *
 * MapLibre is imported here and nowhere else in `sales/`, and `LocationFields`
 * reaches this file through `React.lazy` — the library is ~250 kB gzipped and
 * would otherwise ride along in the Comenzi chunk for everyone who never opens
 * the picker. See the `maplibre` note in `vite.config.ts`.
 */

import { useEffect, useId, useMemo, useRef, useState, type JSX } from 'react';
import { Map as MapLibreMap, Marker, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/features/map/components/mapCanvas.css';
import { Button, Modal, SearchIcon, Spinner, TextInput, cx } from '@/components/ui';
import { parseCoordinates, type LatLng } from '@/types/domain';
import { DEFAULT_VIEW } from '@/features/map/types';
import { MAP_STYLE_URL } from '@/features/map/components/mapStyle';
import {
  MIN_QUERY_LENGTH,
  formatPickedCoordinates,
  reverseGeocode,
  searchAddresses,
  type GeocodeResult,
} from '@/lib/geocoding';
import type { LocationValue } from '../orderModel';

/** A site already in the database, offered as a marker on the map. */
export interface KnownPlace {
  address: string;
  point: LatLng;
  /** How many orders sit at this address — the number drawn in the marker. */
  count: number;
  /** 'client' = this client's own sites; 'other' = anywhere in the database. */
  scope: 'client' | 'other';
}

export interface LocationPickerModalProps {
  open: boolean;
  /** Field label, so the dialog title says which location is being picked. */
  label: string;
  value: LocationValue;
  knownPlaces?: readonly KnownPlace[];
  onCancel: () => void;
  onConfirm: (value: LocationValue) => void;
}

/** Close enough to read house numbers, far enough to see the street. */
const PICK_ZOOM = 16;
const SEARCH_DEBOUNCE_MS = 300;
/** Longer than the search debounce: a pin can be nudged several times in a row. */
const REVERSE_DEBOUNCE_MS = 600;
/**
 * Generous, because it has to be certain: a cold vector-tile cache on a slow
 * connection legitimately takes a while, and telling someone the map is broken
 * while it is merely still arriving is worse than making them wait. Same number
 * and same reasoning as MapCanvas.
 */
const STYLE_TIMEOUT_MS = 20_000;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The draggable pin, as DOM rather than JSX: MapLibre positions a marker by
 * transforming an element it owns, so the element has to exist outside React's
 * tree. Built node by node instead of through `innerHTML` — nothing here is
 * user data, but a sink that could accept it is the kind of thing that gets
 * copied somewhere it matters.
 */
function createPinElement(): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'cursor-grab active:cursor-grabbing';
  wrapper.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '36');
  svg.setAttribute('height', '36');
  svg.style.display = 'block';
  svg.style.filter = 'drop-shadow(0 2px 3px rgba(15, 23, 42, 0.35))';

  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute(
    'd',
    'M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 6.6 12.9 6.9 13.2a.8.8 0 0 0 1.2 0c.3-.3 6.9-7.8 6.9-13.2A7.5 7.5 0 0 0 12 1.5Z',
  );
  body.setAttribute('fill', '#dc2626');

  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', '12');
  dot.setAttribute('cy', '9');
  dot.setAttribute('r', '2.8');
  dot.setAttribute('fill', '#ffffff');

  svg.append(body, dot);
  wrapper.append(svg);
  return wrapper;
}

export function LocationPickerModal({
  open,
  label,
  value,
  knownPlaces = [],
  onCancel,
  onConfirm,
}: LocationPickerModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`${label} — alege pe hartă`}
      width="xl"
      // The map eats drags; a stray one ending on the scrim must not discard
      // the pin the operator just spent a minute placing.
      dismissOnBackdrop={false}
    >
      {/* Remounts per opening, so the map is built fresh against a container
          that is already laid out and at its final size. */}
      {open && (
        <PickerBody
          value={value}
          knownPlaces={knownPlaces}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}

function PickerBody({
  value,
  knownPlaces,
  onCancel,
  onConfirm,
}: {
  value: LocationValue;
  knownPlaces: readonly KnownPlace[];
  onCancel: () => void;
  onConfirm: (value: LocationValue) => void;
}) {
  const fieldId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  /** `Marker.addTo` re-appends the element, so it is called once, not per move. */
  const markerAddedRef = useRef(false);

  const initialPoint = useMemo(() => parseCoordinates(value.coordinates), [value.coordinates]);

  const [point, setPoint] = useState<LatLng | null>(initialPoint);
  const [address, setAddress] = useState(value.address);
  const [dragging, setDragging] = useState(false);
  const [resolving, setResolving] = useState(false);
  /**
   * Set only when a HUMAN placed the pin. A search result and a known place
   * arrive with a better label than reverse geocoding would invent for the same
   * spot, so they set the address directly and leave this alone — otherwise the
   * answer to a search would immediately overwrite itself with a rounder,
   * less specific street name.
   */
  const [pendingReverse, setPendingReverse] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  // ── Mount once: build the map and the pin it drops. ──────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setStatus('loading');

    const start = initialPoint ?? { lat: DEFAULT_VIEW.latitude, lng: DEFAULT_VIEW.longitude };
    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [start.lng, start.lat],
      zoom: initialPoint ? PICK_ZOOM : DEFAULT_VIEW.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    // Expanded, not compact: mapCanvas.css hides the compact toggle button, and
    // the OpenFreeMap/OSM credit has to stay reachable. See MapCanvas.
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
    // The whole canvas is a target — say so.
    map.getCanvas().style.cursor = 'crosshair';

    const marker = new Marker({ element: createPinElement(), anchor: 'bottom', draggable: true });
    markerRef.current = marker;
    markerAddedRef.current = false;

    /** Everything a person does by hand lands here: point first, label after. */
    const placeByHand = (lngLat: { lng: number; lat: number }) => {
      const next = { lat: lngLat.lat, lng: lngLat.lng };
      setPoint(next);
      // Flipped here rather than in the effect below: an effect body that calls
      // setState synchronously is a cascading render, and the gesture is the
      // moment the label genuinely became stale.
      setResolving(true);
      setPendingReverse(next);
    };

    marker.on('dragstart', () => setDragging(true));
    marker.on('dragend', () => {
      setDragging(false);
      placeByHand(marker.getLngLat());
    });

    let loaded = false;
    const loadTimeout = setTimeout(() => {
      if (!loaded) setStatus('failed');
    }, STYLE_TIMEOUT_MS);

    const subscriptions = [
      map.on('click', (event) => placeByHand(event.lngLat)),
      // MapLibre emits `error` for entirely routine startup noise — a raster
      // tile 404 outside Natural Earth's coverage, an aborted request as the
      // camera settles. A genuinely unreachable style simply never reaches
      // `load`, which the timeout above is what catches. Same stance as
      // MapCanvas, where treating any error as fatal once put a permanent
      // failure screen over a tile host that was answering 200 throughout.
      map.on('error', (event) => console.warn('[picker] MapLibre error', event.error ?? event)),
    ];

    map.once('load', () => {
      loaded = true;
      clearTimeout(loadTimeout);
      setStatus('ready');
      // The dialog animates in, so the box MapLibre measured at construction
      // may not be the box it ends up in.
      map.resize();
    });

    // MapLibre measures the container once, at construction. This one is inside
    // a portalled dialog that animates in, so measure again whenever the box
    // actually settles — a 0-height first measurement renders a live map into a
    // 0x0 canvas. See the longer note in MapCanvas.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      clearTimeout(loadTimeout);
      resizeObserver.disconnect();
      for (const subscription of subscriptions) subscription.unsubscribe();
      marker.remove();
      markerRef.current = null;
      markerAddedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // Mount-only: `initialPoint` is the seed for the camera, not a live input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── The pin follows `point`, whoever set it ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (!point) {
      if (markerAddedRef.current) {
        marker.remove();
        markerAddedRef.current = false;
      }
      return;
    }

    marker.setLngLat([point.lng, point.lat]);
    if (!markerAddedRef.current) {
      marker.addTo(map);
      markerAddedRef.current = true;
    }
  }, [point]);

  // ── A hand-placed pin gets its label from reverse geocoding, debounced ────
  useEffect(() => {
    if (!pendingReverse) return;
    let cancelled = false;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void reverseGeocode(pendingReverse, abort.signal).then((found) => {
        if (cancelled) return;
        setResolving(false);
        if (found) setAddress(found);
      });
    }, REVERSE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      abort.abort();
    };
  }, [pendingReverse]);

  // ── Known places as markers ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = knownPlaces.map((place) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.title = place.address;
      element.setAttribute('aria-label', `Locație cunoscută: ${place.address}`);
      element.className = cx(
        'grid size-6 cursor-pointer place-items-center rounded-full text-[10px] font-semibold',
        'text-white shadow ring-2 ring-white',
        place.scope === 'client' ? 'bg-primary' : 'bg-ink-subtle',
      );
      element.textContent = String(place.count);
      element.addEventListener('click', (browserEvent) => {
        // Without this the click also reaches the map and drops the pin at
        // whatever pixel the badge happened to sit on, which is close to the
        // stored point but not equal to it.
        browserEvent.stopPropagation();
        setPoint(place.point);
        // The stored address beats anything reverse geocoding would invent for
        // the same spot, so no `pendingReverse` here.
        setAddress(place.address);
        map.easeTo({ center: [place.point.lng, place.point.lat], zoom: PICK_ZOOM, duration: 500 });
      });
      return new Marker({ element, anchor: 'center' })
        .setLngLat([place.point.lng, place.point.lat])
        .addTo(map);
    });

    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [knownPlaces]);

  // ── Opened on an address with no coordinates: find it, once ──────────────
  useEffect(() => {
    if (initialPoint || !value.address.trim()) return;
    const abort = new AbortController();
    void searchAddresses(value.address, abort.signal).then((found) => {
      const first = found[0];
      if (!first || !mapRef.current) return;
      // The pin lands on the geocoder's answer rather than waiting for a click:
      // the operator opened the picker to ADJUST an address they already typed,
      // and a pin on the right street is a better starting point than none.
      setPoint(first.point);
      mapRef.current.flyTo({
        center: [first.point.lng, first.point.lat],
        zoom: PICK_ZOOM,
        duration: 0,
      });
    });
    return () => abort.abort();
    // Mount-only, for the same reason as the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Address search, debounced and abortable ──────────────────────────────
  // `results` is only ever rendered through `visibleResults`, so a query that
  // drops back under the minimum hides the list without an effect having to
  // clear it — deleting two characters must not leave the previous street
  // sitting there looking like an answer.
  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const visibleResults = searchable ? results : [];

  useEffect(() => {
    if (!searchable) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      void searchAddresses(trimmedQuery, abort.signal).then((found) => {
        setResults(found);
        setHighlighted(found.length > 0 ? 0 : -1);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [trimmedQuery, searchable]);

  const acceptResult = (result: GeocodeResult) => {
    setAddress(result.label);
    setPoint(result.point);
    setQuery('');
    setResults([]);
    setHighlighted(-1);
    mapRef.current?.flyTo({
      center: [result.point.lng, result.point.lat],
      zoom: PICK_ZOOM,
      duration: 600,
    });
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleResults.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((current) => (current + 1) % visibleResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => (current <= 0 ? visibleResults.length - 1 : current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = visibleResults[highlighted] ?? visibleResults[0];
      if (chosen) acceptResult(chosen);
    } else if (event.key === 'Escape') {
      // First Escape closes the suggestion list, second closes the dialog.
      // Modal's own handler is a bubble-phase listener on `document`, so
      // stopping the native event here — which React's synthetic
      // stopPropagation does — is what keeps it from also closing.
      event.stopPropagation();
      setResults([]);
    }
  };

  // ARIA combobox: the input keeps focus and names the active row through
  // `aria-activedescendant`, so the options must not be focusable themselves —
  // that is why they are `<li>`s with a click handler and not buttons.
  const listboxId = `${fieldId}-results`;
  const optionId = (index: number) => `${listboxId}-${index}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <TextInput
          id={fieldId}
          label="Caută adresa"
          value={query}
          placeholder="Str. Exemplu 12, București"
          hint="Caută o adresă, apoi apasă pe hartă pentru a fixa punctul exact."
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={visibleResults.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlighted >= 0 && highlighted < visibleResults.length
              ? optionId(highlighted)
              : undefined
          }
          leading={<SearchIcon />}
          trailing={searching ? <Spinner /> : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        {visibleResults.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Rezultate căutare"
            className={cx(
              'absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg',
              'border border-border bg-surface py-1 shadow-modal',
            )}
          >
            {visibleResults.map((result, index) => (
              <li
                key={result.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === highlighted}
                className={cx(
                  'cursor-pointer px-3 py-1.5',
                  index === highlighted ? 'bg-accent-50' : 'hover:bg-surface-hover',
                )}
                onMouseEnter={() => setHighlighted(index)}
                // `onMouseDown` rather than `onClick`: the input's blur would
                // otherwise fire first and the row would move out from under
                // the pointer as the list re-renders.
                onMouseDown={(event) => {
                  event.preventDefault();
                  acceptResult(result);
                }}
              >
                <span className="block truncate text-sm text-ink">{result.name}</span>
                {result.context && (
                  <span className="block truncate text-xs text-ink-muted">{result.context}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative h-[clamp(14rem,42vh,24rem)] overflow-hidden rounded-lg border border-border bg-surface-sunken">
        {/*
          Inline positioning, not Tailwind's `absolute inset-0`.

          MapLibre stamps its own `.maplibregl-map` class onto whatever element
          you hand it, and maplibre-gl.css declares `position: relative` on that
          class. Loaded after Tailwind's utilities, it wins — so the container
          silently becomes `position: relative`, `inset-0` stops applying, the
          div collapses to height 0, and MapLibre initialises a zero-height
          viewport. It then needs no tiles, never finishes loading, and shows a
          blank white box with no error anywhere, while the camera keeps
          reporting perfectly good coordinates. That is exactly what this picker
          did until now. Inline styles outrank both stylesheets, so it cannot be
          undone by class ordering. Same fix, same reason, as MapCanvas.
        */}
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {status !== 'ready' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-sunken/80 p-4 text-center">
            {status === 'loading' ? (
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <Spinner /> Se încarcă harta…
              </span>
            ) : (
              <span className="text-sm text-ink-muted">
                Harta nu s-a putut încărca. Verifică conexiunea — căutarea adresei funcționează în
                continuare.
              </span>
            )}
          </div>
        )}

        {status === 'ready' && !point && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2">
            <span className="rounded-full bg-ink/75 px-3 py-1 text-xs text-white">
              Apasă pe hartă pentru a pune pinul
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink" title={address || undefined}>
            {address || <span className="text-ink-muted">Nicio adresă încă</span>}
            {resolving && <span className="ml-2 text-xs text-ink-muted">se caută adresa…</span>}
          </p>
          <p className="text-xs tabular-nums text-ink-muted">
            {point
              ? `${formatPickedCoordinates(point)}${dragging ? ' — se mută pinul…' : ''}`
              : 'Apasă pe hartă pentru a fixa punctul.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={onCancel}>Anulează</Button>
          <Button
            variant="primary"
            disabled={!point}
            onClick={() =>
              point &&
              onConfirm({ address: address.trim(), coordinates: formatPickedCoordinates(point) })
            }
          >
            Confirmă locația
          </Button>
        </div>
      </div>
    </div>
  );
}
