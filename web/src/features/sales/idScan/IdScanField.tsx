/**
 * "Scanează buletinul" — the ID scanner as it appears on the client form
 * (TODO-13), and what replaced the ID-photo upload (TODO-14).
 *
 * Three things this component is careful about, all of them consequences of
 * what it is reading:
 *
 * 1. **The photo goes nowhere.** `scanIdImage` runs the engine in this browser
 *    and the file is dropped when it returns. There is no upload, no preview
 *    kept around, no object URL. The panel says so in as many words, because an
 *    operator holding someone else's identity card is entitled to know where
 *    the picture is going, and "nowhere" is only reassuring if it is stated.
 * 2. **A refusal is a normal outcome, and gets a specific message.** Each
 *    `MrzRejection` maps to different advice: retake the photo, retake it more
 *    carefully, or stop scanning and type it. A single "scanarea a eșuat" would
 *    leave the operator re-photographing a card that will never read.
 * 3. **It fills, it does not commit.** The fields stay editable and nothing is
 *    saved by scanning. MRZ text is transliterated, so `Ștefănescu` arrives as
 *    `Stefanescu` and someone has to put the diacritics back — the panel says
 *    that too, next to the result, rather than in a tooltip nobody opens.
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import type { MrzRejection, MrzRead } from './mrz';

type Status =
  | { kind: 'idle' }
  | { kind: 'scanning'; label: string; progress: number }
  | { kind: 'read'; hadCnp: boolean }
  | { kind: 'refused'; message: string };

/**
 * Why the read was refused, in terms of what the operator should do next.
 * `format` and `check-digit` are worth retaking a photo for; the two `cnp-*`
 * codes mean the card was read and disagrees with itself, so another photo of
 * the same card will fail the same way.
 */
const REFUSAL_MESSAGES: Record<MrzRejection, string> = {
  format:
    'Nu am găsit zona citibilă automat — cele trei rânduri de litere și simboluri „<” de la baza actului. Fotografiați actul întreg, drept și bine luminat.',
  'check-digit':
    'Rândurile de la baza actului au fost citite greșit. Încercați o fotografie mai clară, fără reflexii și fără umbre.',
  'cnp-invalid':
    'CNP-ul citit nu trece verificarea cifrei de control. Introduceți datele manual.',
  'cnp-mismatch':
    'Datele citite nu se potrivesc între ele (CNP-ul contrazice data nașterii de pe act). Introduceți datele manual.',
};

const ENGINE_ERROR =
  'Scanarea nu a putut porni pe acest dispozitiv. Introduceți datele manual.';

export function IdScanField({ onRead }: { onRead: (read: MrzRead) => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const scanning = status.kind === 'scanning';

  const handleFile = async (file: File) => {
    setStatus({ kind: 'scanning', label: 'Se pregătește scanarea…', progress: 0 });
    try {
      // Loaded here and not at module scope: the engine and its language model
      // are ~6 MB, and nobody who is not scanning an ID should pay for them.
      const { scanIdImage } = await import('./ocr');
      const result = await scanIdImage(file, (update) =>
        setStatus({ kind: 'scanning', label: update.label, progress: update.progress }),
      );

      if (result.ok) {
        onRead(result.read);
        setStatus({ kind: 'read', hadCnp: result.read.cnp !== null });
      } else {
        setStatus({ kind: 'refused', message: REFUSAL_MESSAGES[result.reason] });
      }
    } catch {
      setStatus({ kind: 'refused', message: ENGINE_ERROR });
    } finally {
      // Let the same file be picked again after a failed read, and drop this
      // browser's reference to it while we are here.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          loading={scanning}
          onClick={() => inputRef.current?.click()}
        >
          Scanează buletinul
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="id-scan-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {scanning && (
          <span className="text-sm text-ink-muted">
            {status.label} {Math.round(status.progress * 100)}%
          </span>
        )}
      </div>

      {status.kind === 'read' && (
        <p className="text-sm text-ink">
          {status.hadCnp
            ? 'Am completat numele și CNP-ul din act.'
            : 'Am completat numele. Actul nu conține CNP — completați-l manual.'}{' '}
          <span className="text-ink-muted">
            Verificați datele și adăugați diacriticele — actul nu le conține.
          </span>
        </p>
      )}

      {status.kind === 'refused' && (
        <p className="text-sm text-danger-700" role="alert">
          {status.message}
        </p>
      )}

      <p className="text-xs text-ink-subtle">
        Fotografia este citită pe acest calculator și nu este trimisă sau salvată nicăieri.
      </p>
    </div>
  );
}
