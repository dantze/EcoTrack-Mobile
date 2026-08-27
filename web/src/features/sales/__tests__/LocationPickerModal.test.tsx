/**
 * The order location picker's wiring, with MapLibre and the geocoder stubbed.
 *
 * WebGL does not exist in jsdom, so the map itself cannot be exercised — but
 * everything that matters here is the plumbing AROUND it, and that is exactly
 * where the bugs live:
 *
 *  - the value the operator confirms must be the point under the PIN, and the
 *    pin is now a marker on the ground: a click drops it, a drag moves it, and
 *    panning the map does neither. Panning used to move the point, which meant
 *    looking around silently rewrote the answer.
 *  - a search result's label must survive the `flyTo` that answers it —
 *    reverse-geocoding that would quietly replace "Strada Lungă 3" with
 *    "Brașov".
 *  - a click or a drag must do the opposite and refresh the label, so the text
 *    and the point never disagree.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * `vi.mock` factories are hoisted above every module-level binding, so the
 * fakes have to be declared inside one — and the handle the tests reach them
 * through has to come from `vi.hoisted`, which runs earlier still.
 */
const fake = vi.hoisted(() => ({
  /** Listeners registered on the map, so a test can fire a "human" click. */
  mapListeners: {} as Record<string, ((event: unknown) => void)[]>,
  /** The draggable pin, once the component has built it. */
  pin: null as null | { setLngLat(lngLat: [number, number]): unknown; fire(type: string): void },
}));

function emit(type: string, event: unknown = {}) {
  for (const listener of fake.mapListeners[type] ?? []) listener(event);
}

/** A click on the canvas, at the coordinates MapLibre would have resolved. */
function clickMap(lat: number, lng: number) {
  emit('click', { lngLat: { lat, lng } });
}

/** A finished pin drag: MapLibre has already moved the marker by `dragend`. */
function dragPin(lat: number, lng: number) {
  fake.pin?.setLngLat([lng, lat]);
  fake.pin?.fire('dragend');
}

vi.mock('maplibre-gl', () => {
  class FakeMap {
    dragRotate = { disable: vi.fn() };
    touchZoomRotate = { disableRotation: vi.fn() };
    keyboard = { disableRotation: vi.fn() };
    addControl = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    getCanvas = () => ({ style: {} }) as HTMLCanvasElement;
    flyTo = vi.fn();
    easeTo = vi.fn();
    on(type: string, listener: (event: unknown) => void) {
      (fake.mapListeners[type] ??= []).push(listener);
      return { unsubscribe: vi.fn() };
    }
    /** `load` fires immediately: nothing under test waits on tiles. */
    once(type: string, listener: () => void) {
      if (type === 'load') listener();
      return this;
    }
  }

  class FakeMarker {
    private lngLat = { lng: 0, lat: 0 };
    private listeners: Record<string, (() => void)[]> = {};
    private element: HTMLElement | null;
    constructor(options?: { draggable?: boolean; element?: HTMLElement }) {
      this.element = options?.element ?? null;
      // The one draggable marker is the pin; the rest are known places.
      if (options?.draggable) fake.pin = this;
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = { lng: lngLat[0], lat: lngLat[1] };
      return this;
    }
    getLngLat() {
      return this.lngLat;
    }
    // Real MapLibre appends the element into the map container. Here it goes
    // to the body — close enough for the known-place badges, which the tests
    // click as ordinary buttons.
    addTo() {
      if (this.element) document.body.append(this.element);
      return this;
    }
    remove() {
      this.element?.remove();
      return this;
    }
    on(type: string, listener: () => void) {
      (this.listeners[type] ??= []).push(listener);
      return this;
    }
    fire(type: string) {
      for (const listener of this.listeners[type] ?? []) listener();
    }
  }

  return { Map: FakeMap, Marker: FakeMarker, AttributionControl: class {} };
});

vi.mock('@/lib/geocoding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/geocoding')>();
  return {
    ...actual,
    searchAddresses: vi.fn(),
    reverseGeocode: vi.fn(),
  };
});

import { searchAddresses, reverseGeocode } from '@/lib/geocoding';
import { LocationPickerModal } from '../components/LocationPickerModal';

const BRASOV = {
  id: 'W1',
  label: 'Strada Lungă 3, Brașov',
  name: 'Strada Lungă 3',
  context: 'Brașov',
  point: { lat: 45.6427, lng: 25.5887 },
};

beforeEach(() => {
  fake.mapListeners = {};
  fake.pin = null;
  vi.mocked(searchAddresses).mockResolvedValue([]);
  vi.mocked(reverseGeocode).mockResolvedValue(null);
});

function open(overrides: Partial<Parameters<typeof LocationPickerModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <LocationPickerModal
      open
      label="Adresă amplasare"
      value={{ address: '', coordinates: '' }}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('LocationPickerModal', () => {
  it('cannot be confirmed before a point exists', () => {
    open();
    expect(screen.getByRole('button', { name: 'Confirmă locația' })).toBeDisabled();
  });

  it('seeds from an existing value and confirms it unchanged', async () => {
    const { onConfirm } = open({
      value: { address: 'Str. Veche 1', coordinates: '44.4268,26.1025' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Str. Veche 1',
      coordinates: '44.4268,26.1025',
    });
  });

  it('drops the pin where the map was clicked', async () => {
    const { onConfirm } = open();

    clickMap(46.7712, 23.6236);

    const confirm = screen.getByRole('button', { name: 'Confirmă locația' });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({
      address: '',
      coordinates: '46.7712,23.6236',
    });
  });

  it('takes both the label and the point from a search result', async () => {
    vi.mocked(searchAddresses).mockResolvedValue([BRASOV]);
    const { onConfirm } = open();

    await userEvent.type(screen.getByLabelText('Caută adresa'), 'strada lunga');
    const option = await screen.findByRole('option', { name: /Strada Lungă 3/ });
    await userEvent.click(option);

    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Strada Lungă 3, Brașov',
      coordinates: '45.6427,25.5887',
    });
  });

  it('does not reverse geocode the search result it just placed', async () => {
    vi.mocked(searchAddresses).mockResolvedValue([BRASOV]);
    open();

    await userEvent.type(screen.getByLabelText('Caută adresa'), 'strada lunga');
    await userEvent.click(await screen.findByRole('option', { name: /Strada Lungă 3/ }));

    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it('re-labels the point after a human drag', async () => {
    vi.mocked(reverseGeocode).mockResolvedValue('Bulevardul Nou 7, Cluj-Napoca');
    const { onConfirm } = open({
      value: { address: 'Str. Veche 1', coordinates: '44.4268,26.1025' },
    });

    dragPin(46.7712, 23.6236);

    await waitFor(() =>
      expect(screen.getByText('Bulevardul Nou 7, Cluj-Napoca')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Bulevardul Nou 7, Cluj-Napoca',
      coordinates: '46.7712,23.6236',
    });
  });

  it('keeps the old label when reverse geocoding finds nothing', async () => {
    vi.mocked(reverseGeocode).mockResolvedValue(null);
    const { onConfirm } = open({
      value: { address: 'Str. Veche 1', coordinates: '44.4268,26.1025' },
    });

    clickMap(46.7712, 23.6236);

    await waitFor(() => expect(reverseGeocode).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    // The point moved, the label did not — a stale label beats no label, and
    // the operator can still see the coordinates changed.
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Str. Veche 1',
      coordinates: '46.7712,23.6236',
    });
  });

  it('picks up a known place with its stored address, not a reverse lookup', async () => {
    const { onConfirm } = open({
      knownPlaces: [
        {
          address: 'Depozit Nord, Ploiești',
          point: { lat: 44.9469, lng: 26.0201 },
          count: 3,
          scope: 'client',
        },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: /Depozit Nord/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    expect(reverseGeocode).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Depozit Nord, Ploiești',
      coordinates: '44.9469,26.0201',
    });
  });

  it('does not query the geocoder for a query below the minimum length', async () => {
    open();
    await userEvent.type(screen.getByLabelText('Caută adresa'), 'bu');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(searchAddresses).not.toHaveBeenCalled();
  });
});
