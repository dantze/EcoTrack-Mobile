/**
 * "Scanează buletinul" — the ID scanner as it appears on the client form
 * (TODO-13), and what replaced the ID-photo upload (TODO-14).
 *
 * Three things this component is careful about, all of them consequences of
 * what it is reading:
 *
 * 1. **The photo goes nowhere.** `scanIdImage` runs the engine in this browser
 *    and the file is dropped when it returns. There is no upload, no preview
 *    kept around, no object URL. The panel says so in as many words — in the
 *    idle state, while scanning, and next to the result — because an operator
 *    holding someone else's identity card is entitled to know where the picture
 *    is going, and "nowhere" is only reassuring if it is stated where they are
 *    looking at the time.
 * 2. **A refusal is a normal outcome, and gets a specific message.** Each
 *    `MrzRejection` maps to different advice: retake the photo, retake it more
 *    carefully, or stop scanning and type it. A single "scanarea a eșuat" would
 *    leave the operator re-photographing a card that will never read. The MRZ
 *    either passes every check digit or is refused — there is no partial fill,
 *    because a half-verified CNP written into a client record is worse than two
 *    fields of typing.
 * 3. **It fills, it does not commit.** The fields stay editable and nothing is
 *    saved by scanning, so the result panel repeats what was extracted for the
 *    operator to check against the card in their hand. MRZ text is
 *    transliterated, so `Ștefănescu` arrives as `Stefanescu` and someone has to
 *    put the diacritics back — said next to the values rather than in a tooltip
 *    nobody opens.
 *
 * The four states are deliberately different shapes, not one row of text that
 * changes wording: a dashed dropzone when idle, a determinate bar while the
 * engine runs, a bordered alert on refusal, a confirmation panel on success.
 */

import { useId, useRef, useState } from 'react';
import { Camera, CircleAlert, CircleCheck, ScanLine, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MrzRejection, MrzRead } from './mrz';

type Status =
  | { kind: 'idle' }
  | { kind: 'scanning'; label: string; progress: number }
  | { kind: 'read'; read: MrzRead }
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

const PRIVACY_NOTE =
  'Fotografia este citită pe acest calculator și nu este trimisă sau salvată nicăieri.';

export function IdScanField({ onRead }: { onRead: (read: MrzRead) => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  /**
   * Which scan the UI is currently showing. Bumped by Anulează and by starting
   * another scan, so a result that arrives after the operator gave up is
   * dropped instead of overwriting what they have since typed.
   */
  const runRef = useRef(0);
  const progressId = useId();

  const clearInputs = () => {
    // Let the same file be picked again after a failed read, and drop this
    // browser's reference to it while we are here.
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    const run = (runRef.current += 1);
    const current = () => runRef.current === run;

    setStatus({ kind: 'scanning', label: 'Se pregătește scanarea…', progress: 0 });
    try {
      // Loaded here and not at module scope: the engine and its language model
      // are ~6 MB, and nobody who is not scanning an ID should pay for them.
      const { scanIdImage } = await import('./ocr');
      const result = await scanIdImage(file, (update) => {
        if (current()) setStatus({ kind: 'scanning', label: update.label, progress: update.progress });
      });
      if (!current()) return;

      if (result.ok) {
        onRead(result.read);
        setStatus({ kind: 'read', read: result.read });
      } else {
        setStatus({ kind: 'refused', message: REFUSAL_MESSAGES[result.reason] });
      }
    } catch {
      if (current()) setStatus({ kind: 'refused', message: ENGINE_ERROR });
    } finally {
      clearInputs();
    }
  };

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void handleFile(file);
  };

  /** Abandon the wait. The engine has no abort signal, so this drops the run. */
  const cancel = () => {
    runRef.current += 1;
    setStatus({ kind: 'idle' });
    clearInputs();
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="id-scan-input"
        onChange={(event) => pick(event.target.files)}
      />
      {/* A second input, because `capture` turns a picker into a camera: one
          input cannot offer both "choose the photo you already took" and
          "take one now", and a phone needs the second. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="id-scan-camera"
        onChange={(event) => pick(event.target.files)}
      />

      {status.kind === 'scanning' ? (
        <div className="rounded-md border border-border bg-surface-raised p-3">
          <div className="flex items-center gap-2">
            <ScanLine aria-hidden className="size-4 shrink-0 animate-pulse text-accent-500" />
            <span id={progressId} className="min-w-0 flex-1 truncate text-sm text-ink">
              {status.label}
            </span>
            <span className="tabular text-xs text-ink-muted">
              {Math.round(status.progress * 100)}%
            </span>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Anulează
            </Button>
          </div>
          <div
            role="progressbar"
            aria-labelledby={progressId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(status.progress * 100)}
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.max(2, Math.round(status.progress * 100))}%` }}
            />
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files);
          }}
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3 transition-colors',
            dragging ? 'border-accent-500 bg-surface-active' : 'border-border bg-surface-raised',
          )}
        >
          <ScanLine aria-hidden className="size-5 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Scanează buletinul</p>
            <p className="text-xs text-ink-muted">
              Trageți fotografia aici, alegeți-o de pe disc sau fotografiați actul.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload aria-hidden />}
              onClick={() => fileRef.current?.click()}
            >
              Alege o fotografie
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Camera aria-hidden />}
              onClick={() => cameraRef.current?.click()}
            >
              Fotografiază
            </Button>
          </div>
        </div>
      )}

      {status.kind === 'read' && (
        <div className="rounded-md border border-success-200 bg-success-50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-success-700">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            {status.read.cnp
              ? 'Am completat numele și CNP-ul din act.'
              : 'Am completat numele. Actul nu conține CNP — completați-l manual.'}
          </p>
          <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-ink-subtle">Nume complet</dt>
              <dd className="truncate text-sm text-ink">{status.read.fullName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-subtle">CNP</dt>
              <dd className="tabular truncate text-sm text-ink">{status.read.cnp ?? 'lipsă'}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-muted">
            Verificați datele și adăugați diacriticele — actul nu le conține. Nimic nu este salvat
            până nu apăsați Salvează.
          </p>
        </div>
      )}

      {status.kind === 'refused' && (
        <div className="rounded-md border border-danger-200 bg-danger-50 p-3">
          <p className="flex items-start gap-2 text-sm text-danger-700" role="alert">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{status.message}</span>
          </p>
          {/* No partial fill on purpose: a failed check digit means something
              was misread and the parser cannot say what, so the choice is a
              better photo or the keyboard. */}
          <p className="mt-2 text-xs text-ink-muted">
            Nu completăm nimic dintr-o citire nesigură. Încercați altă fotografie sau introduceți
            datele manual.
          </p>
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            icon={<Camera aria-hidden />}
            onClick={() => fileRef.current?.click()}
          >
            Încearcă din nou
          </Button>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
        {PRIVACY_NOTE}
      </p>
    </div>
  );
}
