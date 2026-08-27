/**
 * The order picker's geocoding seam.
 *
 * Two things are worth pinning down. Photon's feature shape has to survive
 * being turned into a label an operator recognises — the fields arrive sparse
 * and split, and the joining rules are where "București, București" comes
 * from. And every call has to fail SOFT: the picker's real output is the
 * coordinates under the pin, so a geocoder that is down, rate-limited or
 * answering nonsense must degrade to "no label", never to a thrown error that
 * takes the dialog with it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  featureToResult,
  formatPickedCoordinates,
  reverseGeocode,
  searchAddresses,
} from '../geocoding';

type PhotonFeature = Parameters<typeof featureToResult>[0];

function feature(properties: Record<string, unknown>, lng = 26.1, lat = 44.43): PhotonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties,
  } as PhotonFeature;
}

function respondWith(payload: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('featureToResult', () => {
  it('joins street and house number into one headline', () => {
    const result = featureToResult(
      feature({ street: 'Strada Mihai Eminescu', housenumber: '12', city: 'București' }),
    );
    expect(result?.name).toBe('Strada Mihai Eminescu 12');
    expect(result?.label).toBe('Strada Mihai Eminescu 12, București');
  });

  it('keeps a named place as the headline and demotes its street to context', () => {
    const result = featureToResult(
      feature({
        name: 'Piața Unirii',
        street: 'Bulevardul Unirii',
        city: 'București',
        county: 'București',
      }),
    );
    expect(result?.name).toBe('Piața Unirii');
    // 'București' appears as both city and county; it is said once.
    expect(result?.label).toBe('Piața Unirii, Bulevardul Unirii, București');
  });

  it('does not repeat the headline in its own context', () => {
    const result = featureToResult(feature({ name: 'Cluj-Napoca', city: 'Cluj-Napoca', county: 'Cluj' }));
    expect(result?.label).toBe('Cluj-Napoca, Cluj');
  });

  it('reads lat/lng out of GeoJSON lng-first order', () => {
    const result = featureToResult(feature({ name: 'Test' }, 26.1025, 44.4268));
    expect(result?.point).toEqual({ lat: 44.4268, lng: 26.1025 });
  });

  it('rejects a feature with no usable geometry', () => {
    expect(
      featureToResult({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [] },
        properties: { name: 'Nicăieri' },
      } as unknown as PhotonFeature),
    ).toBeNull();
  });
});

describe('searchAddresses', () => {
  it('does not call the geocoder for a query below the minimum', async () => {
    const fetchMock = respondWith({ features: [] });
    expect(await searchAddresses('bu')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('constrains the search to Romania and asks for local-language names', async () => {
    const fetchMock = respondWith({ features: [] });
    await searchAddresses('strada libertatii');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('q')).toBe('strada libertatii');
    expect(url.searchParams.get('bbox')).toBe('20.26,43.62,29.71,48.27');
    expect(url.searchParams.get('lang')).toBe('default');
  });

  it('maps a feature collection to results', async () => {
    respondWith({ features: [feature({ street: 'Strada Lungă', housenumber: '3', city: 'Brașov' })] });
    const results = await searchAddresses('strada lunga');
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Strada Lungă 3, Brașov');
  });

  it('returns nothing when the geocoder errors, rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(searchAddresses('strada lunga')).resolves.toEqual([]);
  });

  it('returns nothing on a non-OK response', async () => {
    respondWith({ features: [feature({ name: 'ignorat' })] }, false);
    await expect(searchAddresses('strada lunga')).resolves.toEqual([]);
  });

  it('survives a payload that is not a feature collection', async () => {
    respondWith({ message: 'rate limited' });
    await expect(searchAddresses('strada lunga')).resolves.toEqual([]);
  });
});

describe('reverseGeocode', () => {
  it('returns the first feature label', async () => {
    const fetchMock = respondWith({ features: [feature({ street: 'Calea Victoriei', city: 'București' })] });
    await expect(reverseGeocode({ lat: 44.43, lng: 26.1 })).resolves.toBe(
      'Calea Victoriei, București',
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('lat')).toBe('44.43');
    expect(url.searchParams.get('lon')).toBe('26.1');
  });

  it('resolves to null when nothing is found', async () => {
    respondWith({ features: [] });
    await expect(reverseGeocode({ lat: 0, lng: 0 })).resolves.toBeNull();
  });

  it('resolves to null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(reverseGeocode({ lat: 44.43, lng: 26.1 })).resolves.toBeNull();
  });
});

describe('formatPickedCoordinates', () => {
  it('rounds to six decimals — a map pan otherwise writes float noise', () => {
    expect(formatPickedCoordinates({ lat: 44.42681234567, lng: 26.10254999999 })).toBe(
      '44.426812,26.10255',
    );
  });

  it('round-trips through the "lat,lng" the backend stores', () => {
    expect(formatPickedCoordinates({ lat: 44.4268, lng: 26.1025 })).toBe('44.4268,26.1025');
  });
});
