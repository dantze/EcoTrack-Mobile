/**
 * The panel around the parser (TODO-13).
 *
 * `mrz.test.ts` proves the reading is right. This proves the two things that
 * are the panel's own job and that a correct parser cannot save you from:
 *
 *  - a refusal is reported as a refusal, with advice specific to WHY, rather
 *    than quietly filling nothing;
 *  - the photo goes nowhere. The engine is mocked here, so this cannot observe
 *    a network call directly — what it pins is that the component hands the
 *    file to `scanIdImage` and to nothing else, which is the only path a file
 *    could take out of this component.
 *
 * `./ocr` is mocked with a factory so the real module is never loaded: it pulls
 * in tesseract.js, which wants a WASM engine and a 2 MB language model that
 * `npm run test:run` has no business downloading.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MrzResult } from '../idScan/mrz';

const scanIdImage = vi.fn<(file: Blob) => Promise<MrzResult>>();

vi.mock('../idScan/ocr', () => ({
  scanIdImage: (file: Blob) => scanIdImage(file),
}));

const { IdScanField } = await import('../idScan/IdScanField');

const photo = () => new File(['not-really-a-jpeg'], 'buletin.jpg', { type: 'image/jpeg' });

async function upload() {
  // The input is hidden behind the button, so target it directly — userEvent
  // refuses to type into something it considers invisible.
  const input = screen.getByTestId('id-scan-input');
  await userEvent.upload(input, photo());
}

describe('IdScanField', () => {
  it('fills the form from a good read and says the diacritics are missing', async () => {
    scanIdImage.mockResolvedValue({
      ok: true,
      read: {
        fullName: 'Popescu Ion Andrei',
        cnp: '1800101401237',
        sex: 'M',
        birthDate: '1980-01-01',
      },
    });
    const onRead = vi.fn();

    render(<IdScanField onRead={onRead} />);
    await upload();

    await waitFor(() =>
      expect(onRead).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'Popescu Ion Andrei', cnp: '1800101401237' }),
      ),
    );
    expect(await screen.findByText(/diacriticele/i)).toBeInTheDocument();
  });

  it('says the CNP is still to be typed when the document carries none', async () => {
    scanIdImage.mockResolvedValue({
      ok: true,
      read: { fullName: 'Mueller Anna', cnp: null, sex: 'F', birthDate: null },
    });

    render(<IdScanField onRead={vi.fn()} />);
    await upload();

    expect(await screen.findByText(/nu conține CNP/i)).toBeInTheDocument();
  });

  it('fills nothing when the read is refused', async () => {
    scanIdImage.mockResolvedValue({ ok: false, reason: 'cnp-invalid' });
    const onRead = vi.fn();

    render(<IdScanField onRead={onRead} />);
    await upload();

    expect(await screen.findByRole('alert')).toHaveTextContent(/cifrei de control/i);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('gives different advice for a bad photo than for a card that contradicts itself', async () => {
    scanIdImage.mockResolvedValue({ ok: false, reason: 'format' });
    const { unmount } = render(<IdScanField onRead={vi.fn()} />);
    await upload();
    // "Retake the photo" — worth trying again.
    expect(await screen.findByRole('alert')).toHaveTextContent(/Fotografiați actul întreg/i);
    unmount();

    scanIdImage.mockResolvedValue({ ok: false, reason: 'cnp-mismatch' });
    render(<IdScanField onRead={vi.fn()} />);
    await upload();
    // "Type it instead" — another photo of the same card fails the same way.
    expect(await screen.findByRole('alert')).toHaveTextContent(/manual/i);
  });

  it('survives an engine that will not start, and says so', async () => {
    scanIdImage.mockRejectedValue(new Error('WebAssembly.instantiate failed'));
    const onRead = vi.fn();

    render(<IdScanField onRead={onRead} />);
    await upload();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Introduceți datele manual/i);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('tells the operator the photo stays on this machine', () => {
    render(<IdScanField onRead={vi.fn()} />);
    expect(screen.getByText(/nu este trimisă sau salvată nicăieri/i)).toBeInTheDocument();
  });

  it('hands the file to the local engine and nowhere else', async () => {
    scanIdImage.mockResolvedValue({ ok: false, reason: 'format' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<IdScanField onRead={vi.fn()} />);
    await upload();
    await screen.findByRole('alert');

    expect(scanIdImage).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // TODO-58. `accept="image/*"` constrains the picker dialog and nothing else,
  // so a dropped file is whatever the operator dragged.
  it('refuses a dropped file that is not an image, without starting the engine', async () => {
    render(<IdScanField onRead={vi.fn()} />);

    const dropzone = screen.getByText('Scanează buletinul').closest('div')!.parentElement!;
    const contract = new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/pdf' });

    fireEvent.drop(dropzone, { dataTransfer: { files: [contract] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/nu este o imagine/i);
    // The point of checking first: the engine's own failure would have been
    // reported as "scanning could not start on this device".
    expect(scanIdImage).not.toHaveBeenCalled();
  });

  it('keeps the drop highlight while the pointer crosses a child element', () => {
    // `dragleave` bubbles from children, so a naive boolean flickers the
    // highlight off while the file is still over the dropzone.
    render(<IdScanField onRead={vi.fn()} />);

    const label = screen.getByText('Scanează buletinul');
    const dropzone = label.closest('div')!.parentElement!;

    fireEvent.dragEnter(dropzone);
    expect(dropzone.className).toContain('border-accent-500');

    // Pointer moves onto the inner text: enter the child, leave the parent.
    fireEvent.dragEnter(label);
    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).toContain('border-accent-500');

    // Genuinely leaving unwinds the remaining depth.
    fireEvent.dragLeave(label);
    expect(dropzone.className).not.toContain('border-accent-500');
  });
});
