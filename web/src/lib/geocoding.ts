/**
 * Address search and reverse geocoding for the order location picker.
 *
 * Deliberately NOT routed through `@/api`. That contract is the EcoTrack
 * backend, and this is a third-party host: sending it through `http.ts` would
 * attach our bearer token to a request that leaves for someone else's server.
 * `mobile/`'s `LocationPicker` makes the same call the same way and for the
 * same reason — see the note in CLAUDE.md.
 *
 * The provider is Photon (Komoot's OSM geocoder): no API key, no signup, and
 * built for as-you-type autocomplete, which Nominatim's usage policy
 * explicitly forbids. It pairs with the OpenFreeMap tiles the map screen
 * already uses — both are OSM-derived, so a search result and the street it
 * lands on come from the same data. Swapping providers is `GEOCODER_URL` plus
 * `featureToResult`; nothing else in the app knows the shape.
 *
 * Mobile uses Google Places instead. That is not worth unifying: it has a key
 * provisioned through `app.config.js` and a Google-rendered MapView, while the
 * web has neither, and adding a billed Google key to a public SPA bundle to
 * match would be a step backwards.
 */

import { formatCoordinates, type LatLng } from '@/types/domain';

const GEOCODER_URL = 'https://photon.komoot.io';

/**
 * Romania's bounding box, as `minLon,minLat,maxLon,maxLat`. Photon has no
 * country filter, so this is what stops "Alba" matching a street in Spain.
 * A bias, not a hard fence — Photon still ranks by relevance inside it.
 */
const ROMANIA_BBOX = '20.26,43.62,29.71,48.27';

/**
 * `lang` accepts only default/en/de/fr/it. `default` returns each feature's
 * local name, which for Romania is already Romanian — better than `en`, which
 * would hand back "Bucharest".
 */
const LANG = 'default';

const SEARCH_LIMIT = 6;

/** Below this a query matches half of Romania; Photon is not asked at all. */
export const MIN_QUERY_LENGTH = 3;

export interface GeocodeResult {
  /** Stable enough to key a list on; Photon has no id of its own. */
  id: string;
  /** One-line label: "Str. Exemplu 12, București". */
  label: string;
  /** The leading part of `label` — the street or place name. */
  name: string;
  /** The rest — locality, county, country. Empty when there is nothing to add. */
  context: string;
  point: LatLng;
}

/** Photon returns GeoJSON; only these properties are read. */
interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  osm_id?: number;
  osm_type?: string;
}

/**
 * Photon puts the house number in its own field and the street in another, and
 * fills `name` only for named places (a business, a village). Joining them in
 * this order is what turns three sparse fields into an address someone
 * recognises, and dropping duplicates is what stops "București, București".
 */
export function featureToResult(
  feature: GeoJSON.Feature<GeoJSON.Point, PhotonProperties>,
): GeocodeResult | null {
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const props = feature.properties ?? {};
  const street = [props.street, props.housenumber].filter(Boolean).join(' ');
  // `name` is the headline when there is one; the street becomes context.
  // Without a name the street IS the headline.
  const name = props.name || street || props.city || props.county || 'Locație fără nume';

  const contextParts = [
    props.name ? street : '',
    props.district,
    props.city,
    props.county,
    props.state,
  ];
  const context = dedupe(contextParts, name).join(', ');

  return {
    id: props.osm_type && props.osm_id ? `${props.osm_type}${props.osm_id}` : `${lat},${lng}`,
    label: context ? `${name}, ${context}` : name,
    name,
    context,
    point: { lat, lng },
  };
}

/** Drops blanks, repeats, and anything already said in `headline`. */
function dedupe(parts: (string | undefined)[], headline: string): string[] {
  const seen = new Set([headline.toLowerCase()]);
  const kept: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(value);
  }
  return kept;
}

function parseCollection(payload: unknown): GeocodeResult[] {
  const features = (payload as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => featureToResult(feature as GeoJSON.Feature<GeoJSON.Point, PhotonProperties>))
    .filter((result): result is GeocodeResult => result !== null);
}

/**
 * Forward search. Callers debounce and pass an `AbortSignal` so a keystroke
 * cancels the request the previous one started — Photon answers out of order
 * often enough that without it the list flickers back to a stale query.
 *
 * Resolves to `[]` on any failure. A geocoder being down must not break the
 * picker: dragging the pin still produces perfectly good coordinates, which is
 * the part of this screen that has to keep working.
 */
export async function searchAddresses(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const url = new URL('/api', GEOCODER_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('lang', LANG);
  url.searchParams.set('limit', String(SEARCH_LIMIT));
  url.searchParams.set('bbox', ROMANIA_BBOX);

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return [];
    return parseCollection(await response.json());
  } catch {
    return [];
  }
}

/**
 * Reverse geocode, for the address label under a pin the operator dragged.
 * Resolves to `null` rather than throwing: the coordinates are already correct
 * at that point and the label is a convenience.
 */
export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<string | null> {
  const url = new URL('/reverse', GEOCODER_URL);
  url.searchParams.set('lat', String(point.lat));
  url.searchParams.set('lon', String(point.lng));
  url.searchParams.set('lang', LANG);
  url.searchParams.set('limit', '1');

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    return parseCollection(await response.json())[0]?.label ?? null;
  } catch {
    return null;
  }
}

/** `formatCoordinates` rounded to ~1 m, so a pin drag does not write 14 decimals. */
export function formatPickedCoordinates(point: LatLng): string {
  return formatCoordinates({
    lat: Number(point.lat.toFixed(6)),
    lng: Number(point.lng.toFixed(6)),
  });
}
