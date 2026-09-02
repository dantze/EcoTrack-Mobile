/**
 * The app's one public route — and the only way in.
 *
 * There is no password and no Google sign-in: both were removed from the
 * backend outright. Instead this device asks an admin for access, shows a
 * six-digit code, and waits. The admin checks the code matches what the person
 * reads out, picks a role, and approves; this screen polls until it can
 * exchange its one-time secret for tokens.
 *
 * Three states, in order:
 *   form     → name (+ the first-run setup code, only on a fresh instance)
 *   waiting  → the six-digit code, a countdown, polling
 *   done     → "Sunteți înregistrat cu rol de X", then into the app
 *
 * Those three are rendered as a stepper rather than three unrelated cards,
 * because the middle one is a WAIT: someone staring at a code needs to see
 * that something else has to happen before anything changes, and roughly how
 * far along they are. It is the difference between "waiting" and "broken".
 *
 * It is a route, not a modal, so it can be reached with a live session
 * already in hand: the address bar keeps /login after a bounce, and mock mode
 * enrolls itself on boot whichever URL was loaded. An authenticated visitor is
 * therefore redirected out rather than shown a form for access they already
 * have — without that, `npm run dev` opened on /login sat on the enrollment
 * screen forever while signed in as ADMIN.
 *
 * The pending ticket is persisted (see auth/storage.ts), so reloading or
 * accidentally closing the tab does not force the user to start over and read
 * out a different code.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Check, Copy, Leaf, ShieldCheck } from 'lucide-react';
import { api } from '@/api';
import type { EnrollmentStatus } from '@/api/contract';
import { useAuth } from '@/auth';
import {
  clearPendingTicket,
  readOrCreateDeviceId,
  readPendingTicket,
  savePendingTicket,
} from '@/auth/storage';
import { Button, IconButton, Spinner, TextInput, cx } from '@/components/ui';
import { ROLE_LABELS } from '@/components/domain';
import type { Role } from '@/types/domain';

/** How often the waiting screen asks whether an admin has decided yet. */
const POLL_INTERVAL_MS = 3000;

type Phase = 'form' | 'waiting' | 'done';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'form', label: 'Cerere' },
  { phase: 'waiting', label: 'Aprobare' },
  { phase: 'done', label: 'Acces' },
];

function useCountdown(expiresAt: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return null;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function EnrollmentPage() {
  const { adoptSession, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where RequireAuth was headed when it bounced the user here, so being let
  // in lands on the screen they actually asked for.
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const destination = from && from !== '/login' ? from : '/';

  const [phase, setPhase] = useState<Phase>(() => (readPendingTicket() ? 'waiting' : 'form'));
  const [fullName, setFullName] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverStatus, setServerStatus] = useState<EnrollmentStatus | null>(null);
  const [grantedRole, setGrantedRole] = useState<Role | null>(null);

  const ticket = readPendingTicket();
  const countdown = useCountdown(phase === 'waiting' ? (ticket?.expiresAt ?? null) : null);

  // Only used to stop the poll once we are done with it.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    void api.enrollment
      .status()
      .then(setServerStatus)
      .catch(() => setServerStatus(null));
  }, []);

  const startOver = useCallback(
    (message: string | null) => {
      stopPolling();
      clearPendingTicket();
      setPhase('form');
      setError(message);
    },
    [stopPolling],
  );

  /** One poll tick: ask whether the request has been decided. */
  const poll = useCallback(async () => {
    const pending = readPendingTicket();
    if (!pending) {
      stopPolling();
      return;
    }
    try {
      const result = await api.enrollment.claim(pending.requestId, pending.claimSecret);
      if (result.state === 'issued') {
        stopPolling();
        clearPendingTicket();
        setGrantedRole(result.session.user.roles[0] ?? null);
        setPhase('done');
        // Show the confirmation for a beat before dropping into the app, so
        // the user actually reads which role they were given.
        setTimeout(() => {
          adoptSession(result.session);
          navigate(destination, { replace: true });
        }, 1800);
        return;
      }
      if (result.state === 'rejected' || result.state === 'expired' || result.state === 'unknown') {
        startOver(result.message);
      }
      // 'pending' → keep waiting.
    } catch {
      // A transient network failure must not kill the wait; the next tick retries.
    }
  }, [adoptSession, destination, navigate, startOver, stopPolling]);

  // A ticket that outlived its usefulness: the session came from somewhere else
  // (another tab, the boot restore, mock enrolling itself), so the request this
  // device is still holding will never be claimed. Dropping it here is what
  // keeps a later logout from landing back on a dead waiting screen showing a
  // code no admin will ever be asked about.
  useEffect(() => {
    if (status !== 'authenticated') return;
    stopPolling();
    clearPendingTicket();
  }, [status, stopPolling]);

  // The one `react-hooks/set-state-in-effect` this file keeps, deliberately
  // (TODO-26). The rule's two escapes do not apply: there is nothing to derive
  // during render, because the answer lives on the server and arrives in its own
  // time, and there is no event to move it into — waiting for an admin to
  // approve a device IS the screen. Polling a remote resource and storing what
  // comes back is what an effect is for. The lint sees `void poll()` running
  // synchronously in the effect body; that first immediate tick is the point,
  // since otherwise the screen sits idle for POLL_INTERVAL_MS before the first
  // question, and an already-approved request takes three seconds to notice.
  useEffect(() => {
    if (phase !== 'waiting') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    void poll();
    pollingRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => stopPolling();
  }, [phase, poll, stopPolling]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) {
      setError('Introdu numele complet');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.enrollment.request({
        fullName: name,
        deviceId: readOrCreateDeviceId(),
        deviceLabel: navigator.userAgent,
        setupCode: setupCode.trim() || undefined,
      });
      savePendingTicket({
        requestId: created.requestId,
        claimSecret: created.claimSecret,
        verificationCode: created.verificationCode,
        expiresAt: created.expiresAt,
      });
      setPhase('waiting');
    } catch {
      setError('Cererea nu a putut fi trimisă. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  }

  // Both guards sit below every hook on purpose — an early return above them
  // would change the hook order between renders.
  //
  // 'loading' is still undecided (the boot restore, or mock enrolling itself),
  // and rendering the form during it would flash "cere acces" at someone who is
  // about to be signed in. Same spinner as RequireAuth, same reason.
  if (status === 'loading') {
    return (
      <Field>
        <Spinner className="size-6 text-sidebar-foreground" />
      </Field>
    );
  }
  // 'done' is exempt: that branch has just been issued a session and is showing
  // the role for a beat before navigating itself.
  if (status === 'authenticated' && phase !== 'done') {
    return <Navigate to={destination} replace />;
  }

  return (
    <Field>
      <div className="w-full max-w-md">
        <Lockup />

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-modal sm:p-7">
          <Stepper phase={phase} />

          {phase === 'form' && (
            <>
              <h1 className="mt-6 text-base font-semibold text-ink">Cere acces</h1>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {serverStatus?.awaitingBootstrap
                  ? 'Nicio persoană nu are încă acces. Prima cerere devine administrator.'
                  : serverStatus?.adminLockout
                    ? 'Niciun administrator nu mai este conectat, deci nimeni nu poate aproba cereri. Cu codul de recuperare din jurnalul serverului poți crea un administrator nou.'
                    : 'Trimite o cerere de acces. Un administrator o va aproba.'}
              </p>

              <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4" noValidate>
                <TextInput
                  label="Nume complet"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoFocus
                  autoComplete="name"
                />

                {/* One field, two states — first run and admin lockout (TODO-30).
                    `setupCodeRequired` is true for both; only the wording tells
                    them apart, because the person reading it is looking for the
                    code in a different place each time. */}
                {serverStatus?.setupCodeRequired && (
                  <TextInput
                    label={serverStatus.adminLockout ? 'Cod de recuperare' : 'Cod de configurare'}
                    hint={
                      serverStatus.adminLockout
                        ? 'Afișat în jurnalul serverului când ultimul administrator s-a deconectat.'
                        : 'Afișat în log-ul serverului la prima pornire.'
                    }
                    value={setupCode}
                    onChange={(event) => setSetupCode(event.target.value)}
                    autoComplete="off"
                  />
                )}

                {error && <ErrorNote>{error}</ErrorNote>}

                <Button type="submit" variant="primary" block loading={submitting}>
                  {submitting ? 'Se trimite…' : 'Solicită acces'}
                </Button>
              </form>
            </>
          )}

          {phase === 'waiting' && ticket && (
            <>
              <h1 className="mt-6 text-base font-semibold text-ink">Spune codul administratorului</h1>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Îl va compara cu cel de pe ecranul lui înainte să aprobe. Ține pagina deschisă.
              </p>

              <CodeDisplay code={ticket.verificationCode} />

              <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm text-ink-muted">
                <Spinner className="size-4 shrink-0" />
                <span>Se așteaptă aprobarea</span>
                {countdown && (
                  <span className="tabular text-ink-subtle">· expiră în {countdown}</span>
                )}
              </div>

              {error && <ErrorNote className="mt-4">{error}</ErrorNote>}

              <Button variant="ghost" block className="mt-4" onClick={() => startOver(null)}>
                Anulează cererea
              </Button>
            </>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-600 ring-1 ring-success-200 ring-inset">
                <ShieldCheck aria-hidden className="size-5" />
              </span>
              <p className="text-base font-medium text-ink">
                Sunteți înregistrat cu rol de {grantedRole ? ROLE_LABELS[grantedRole] : 'utilizator'}
              </p>
              <p className="text-sm text-ink-muted">Vă ducem în aplicație…</p>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-sidebar-foreground/70">
          Accesul se acordă per dispozitiv. Nu există parolă — dacă schimbi telefonul sau
          browserul, ceri acces din nou.
        </p>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/**
 * The navy field the card sits on. Uses the app rail's own colour rather than a
 * page background: this screen has no rail, and borrowing its navy is what
 * makes /login read as the same product in both themes without a `dark:` rule.
 */
function Field({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      {children}
    </div>
  );
}

function Lockup() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Leaf aria-hidden className="size-5" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">EcoTrack</span>
    </div>
  );
}

/** Where in the three-step flow this device is. Purely informative. */
function Stepper({ phase }: { phase: Phase }) {
  const current = STEPS.findIndex((step) => step.phase === phase);

  return (
    <ol className="flex items-center gap-2" aria-label="Pașii înregistrării">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.phase} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={cx(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done && 'bg-success-100 text-success-700',
                active && 'bg-primary text-primary-foreground',
                !done && !active && 'bg-surface-sunken text-ink-subtle ring-1 ring-border ring-inset',
              )}
            >
              {done ? <Check aria-hidden className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cx(
                'truncate text-xs',
                active ? 'font-medium text-ink' : 'text-ink-subtle',
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden className="h-px min-w-2 flex-1 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The six digits, one box each.
 *
 * Grouped rather than run together because this number is READ ALOUD — the
 * person on the other end of the call is transcribing it, and a wall of six
 * glyphs is where digits get dropped. The copy button is for the other route,
 * where the code goes into a chat message.
 */
function CodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused outright (insecure context, denied
      // permission). The code is on screen either way, so there is nothing to
      // recover from and nothing worth interrupting the user about.
    }
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <div
        className="flex gap-1.5 sm:gap-2"
        role="group"
        aria-label={`Cod de verificare: ${code.split('').join(' ')}`}
      >
        {code.split('').map((digit, index) => (
          <span
            key={index}
            aria-hidden
            className="flex size-11 items-center justify-center rounded-md border border-border bg-surface-sunken font-mono text-xl font-semibold text-ink tabular-nums sm:size-12 sm:text-2xl"
          >
            {digit}
          </span>
        ))}
      </div>
      <IconButton
        label={copied ? 'Cod copiat' : 'Copiază codul'}
        variant="ghost"
        onClick={() => void copy()}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </IconButton>
    </div>
  );
}

function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cx(
        'rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700',
        className,
      )}
    >
      {children}
    </p>
  );
}
