/**
 * Map picker for an order's location (TODO-10).
 *
 * The desktop equivalent of `mobile/app/Sales/OrderTypes/OrderComponents/
 * LocationPicker.tsx`, and deliberately the same interaction model: search an
 * address, then drag the map under a fixed centre pin until the pin is on the
 * actual gate/manhole. Coordinates come from where the pin ENDS UP, never from
 * the geocoder — a search result lands you on the right street, the drag is
 * what makes it the right spot on it.
 *
 * Three things fill the value, in the order an operator reaches for them:
 *   1. a known place — somewhere this client (or anyone) has been served
 *      before, drawn as a numbered marker. Exact coordinates, zero typing.
 *   2. an address search, which flies the map to the result.
 *   3. dragging the map, which reverse-geocodes a label for the new point.
 *
 * A dragged pin overwrites the address label on purpose. An address that no
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
/** Longer than the search debounce: dragging is continuous, typing is not. */
const REVERSE_DEBOUNCE_MS = 700;

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

  const initialPoint = useMemo(() => parseCoordinates(value.coordinates), [value.coordinates]);

  const [point, setPoint] = useState<LatLng | null>(initialPoint);
  const [address, setAddress] = useState(value.address);
  const [moving, setMoving] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  // ── Mount once: build the map, wire the drag → point → reverse chain. ─────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    let reverseTimer: ReturnType<typeof setTimeout> | undefined;
    let reverseAbort: AbortController | undefined;

    const subscriptions = [
      map.on('movestart', () => setMoving(true)),
      map.on('moveend', (event) => {
        setMoving(false);
        const center = map.getCenter();
        const next = { lat: center.lat, lng: center.lng };
        setPoint(next);

        // `originalEvent` is present only when a human moved the map. Without
        // this guard the `flyTo` that ANSWERS a search would immediately
        // reverse-geocode its own destination and overwrite the label the
        // operator just picked with a rounder, less specific one.
        if (!event.originalEvent) return;

        clearTimeout(reverseTimer);
        reverseAbort?.abort();
        setResolving(true);
        reverseTimer = setTimeout(() => {
          reverseAbort = new AbortController();
          void reverseGeocode(next, reverseAbort.signal).then((found) => {
            setResolving(false);
            if (found) setAddress(found);
          });
        }, REVERSE_DEBOUNCE_MS);
      }),
    ];

    // MapLibre measures the container once, at construction. This one is inside
    // a portalled dialog that animates in, so measure again whenever the box
    // actually settles — a 0-height first measurement renders a live map into a
    // 0x0 canvas. See the longer note in MapCanvas.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      clearTimeout(reverseTimer);
      reverseAbort?.abort();
      resizeObserver.disconnect();
      for (const subscription of subscriptions) subscription.unsubscribe();
      map.remove();
      mapRef.current = null;
    };
    // Mount-only: `initialPoint` is the seed for the camera, not a live input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        place.scope === 'client' ? 'bg-brand-600' : 'bg-slate-400',
      );
      element.textContent = String(place.count);
      element.addEventListener('click', (browserEvent) => {
        browserEvent.stopPropagation();
        // Snapping is a camera move, so `moveend` writes the point; the address
        // is set here because the stored one beats anything reverse geocoding
        // would invent for the same spot.
        map.flyTo({ center: [place.point.lng, place.point.lat], zoom: PICK_ZOOM, duration: 500 });
        setAddress(place.address);
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
          hint="Caută o adresă, apoi trage harta pentru a fixa punctul exact."
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
              'border border-border bg-white py-1 shadow-modal',
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
                  index === highlighted ? 'bg-brand-50' : 'hover:bg-surface-sunken',
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

      <div className="relative h-[clamp(14rem,42vh,24rem)] overflow-hidden rounded-lg border border-border">
        <div ref={containerRef} className="absolute inset-0" />
        {/* Anchored at the tip, lifted while dragging so the pin reads as
            hovering over the map rather than stuck to it. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className={cx(
              'size-9 drop-shadow-md transition-transform duration-150',
              moving && '-translate-y-1.5',
            )}
            fill="var(--color-danger-600, #dc2626)"
          >
            <path d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 6.6 12.9 6.9 13.2a.8.8 0 0 0 1.2 0c.3-.3 6.9-7.8 6.9-13.2A7.5 7.5 0 0 0 12 1.5Z" />
            <circle cx="12" cy="9" r="2.8" fill="white" />
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink" title={address || undefined}>
            {address || <span className="text-ink-muted">Nicio adresă încă</span>}
            {resolving && <span className="ml-2 text-xs text-ink-muted">se caută adresa…</span>}
          </p>
          <p className="text-xs tabular-nums text-ink-muted">
            {point
              ? formatPickedCoordinates(point)
              : 'Trage harta pentru a fixa punctul.'}
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
