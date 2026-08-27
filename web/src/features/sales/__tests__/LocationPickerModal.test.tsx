/**
 * The order location picker's wiring, with MapLibre and the geocoder stubbed.
 *
 * WebGL does not exist in jsdom, so the map itself cannot be exercised — but
 * everything that matters here is the plumbing AROUND it, and that is exactly
 * where the bugs live:
 *
 *  - the value the operator confirms must be the point under the PIN, i.e. the
 *    map centre, never the coordinates the geocoder returned. Search puts you
 *    on the street; the drag puts you on the gate.
 *  - a search result's label must survive the `flyTo` that answers it. The map
 *    fires `moveend` for programmatic moves too, and reverse-geocoding that
 *    would quietly replace "Strada Lungă 3" with "Brașov".
 *  - a human drag must do the opposite and refresh the label, so the text and
 *    the point never disagree.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Centre the fake map reports, mutated by `flyTo` and by the test itself. */
let centre = { lat: 45.9, lng: 25.0 };
/** Listeners registered by the component, so a test can fire a "human" drag. */
let listeners: Record<string, ((event: unknown) => void)[]> = {};

function emit(type: string, event: unknown = {}) {
  for (const listener of listeners[type] ?? []) listener(event);
}

vi.mock('maplibre-gl', () => {
  class FakeMap {
    dragRotate = { disable: vi.fn() };
    touchZoomRotate = { disableRotation: vi.fn() };
    keyboard = { disableRotation: vi.fn() };
    addControl = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    getCenter = () => centre;
    on(type: string, listener: (event: unknown) => void) {
      (listeners[type] ??= []).push(listener);
      return { unsubscribe: vi.fn() };
    }
    /** Real MapLibre fires move events for programmatic moves, WITHOUT an
     *  `originalEvent`. That distinction is the thing under test. */
    flyTo({ center }: { center: [number, number] }) {
      centre = { lat: center[1], lng: center[0] };
      emit('movestart', {});
      emit('moveend', {});
    }
  }
  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove = vi.fn();
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
  centre = { lat: 45.9, lng: 25.0 };
  listeners = {};
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

  it('takes a search result label but the MAP CENTRE as the point', async () => {
    vi.mocked(searchAddresses).mockResolvedValue([BRASOV]);
    const { onConfirm } = open();

    await userEvent.type(screen.getByLabelText('Caută adresa'), 'strada lunga');
    const option = await screen.findByRole('option', { name: /Strada Lungă 3/ });
    await userEvent.click(option);

    // The fake map's flyTo moved the centre exactly onto the result, so the two
    // agree here — what matters is that the value came from getCenter().
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Strada Lungă 3, Brașov',
      coordinates: '45.6427,25.5887',
    });
  });

  it('does not reverse geocode the flyTo that answers a search', async () => {
    vi.mocked(searchAddresses).mockResolvedValue([BRASOV]);
    open();

    await userEvent.type(screen.getByLabelText('Caută adresa'), 'strada lunga');
    await userEvent.click(await screen.findByRole('option', { name: /Strada Lungă 3/ }));

    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it('re-labels the point after a human drag', async () => {
    vi.mocked(reverseGeocode).mockResolvedValue('Bulevardul Nou 7, Cluj-Napoca');
    const { onConfirm } = open({ value: { address: 'Str. Veche 1', coordinates: '44.4268,26.1025' } });

    centre = { lat: 46.7712, lng: 23.6236 };
    // `originalEvent` present = a real gesture, which is what unlocks the
    // reverse lookup.
    emit('moveend', { originalEvent: new MouseEvent('mouseup') });

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
    const { onConfirm } = open({ value: { address: 'Str. Veche 1', coordinates: '44.4268,26.1025' } });

    centre = { lat: 46.7712, lng: 23.6236 };
    emit('moveend', { originalEvent: new MouseEvent('mouseup') });

    await waitFor(() => expect(reverseGeocode).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Confirmă locația' }));
    // The point moved, the label did not — a stale label beats no label, and
    // the operator can still see the coordinates changed.
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Str. Veche 1',
      coordinates: '46.7712,23.6236',
    });
  });

  it('does not query the geocoder for a query below the minimum length', async () => {
    open();
    await userEvent.type(screen.getByLabelText('Caută adresa'), 'bu');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(searchAddresses).not.toHaveBeenCalled();
  });
});
