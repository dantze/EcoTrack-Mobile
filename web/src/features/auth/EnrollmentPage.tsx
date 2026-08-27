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
 * The pending ticket is persisted (see auth/storage.ts), so reloading or
 * accidentally closing the tab does not force the user to start over and read
 * out a different code.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import type { EnrollmentStatus } from '@/api/contract';
import { useAuth } from '@/auth';
import {
  clearPendingTicket,
  readOrCreateDeviceId,
  readPendingTicket,
  savePendingTicket,
} from '@/auth/storage';
import { Button, Spinner, TextInput } from '@/components/ui';
import { ROLE_LABELS } from '@/components/domain';
import type { Role } from '@/types/domain';

/** How often the waiting screen asks whether an admin has decided yet. */
const POLL_INTERVAL_MS = 3000;

type Phase = 'form' | 'waiting' | 'done';

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
  const { adoptSession } = useAuth();
  const navigate = useNavigate();

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
          navigate('/', { replace: true });
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
  }, [adoptSession, navigate, startOver, stopPolling]);

  useEffect(() => {
    if (phase !== 'waiting') return;
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-content">EcoTrack</h1>

        {phase === 'form' && (
          <>
            <p className="mt-1 text-sm text-content-muted">
              {serverStatus?.awaitingBootstrap
                ? 'Nicio persoană nu are încă acces. Prima cerere devine administrator.'
                : 'Trimite o cerere de acces. Un administrator o va aproba.'}
            </p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
              <TextInput
                label="Nume complet"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoFocus
                autoComplete="name"
              />

              {serverStatus?.setupCodeRequired && (
                <TextInput
                  label="Cod de configurare"
                  hint="Afișat în log-ul serverului la prima pornire."
                  value={setupCode}
                  onChange={(event) => setSetupCode(event.target.value)}
                  autoComplete="off"
                />
              )}

              {error && (
                <p role="alert" className="text-sm text-danger-600">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Se trimite…' : 'Solicită acces'}
              </Button>
            </form>
          </>
        )}

        {phase === 'waiting' && ticket && (
          <>
            <p className="mt-1 text-sm text-content-muted">
              Spune acest cod administratorului. El îl va verifica înainte să aprobe.
            </p>

            <p className="my-8 text-center font-mono text-5xl tracking-[0.3em] text-content">
              {ticket.verificationCode}
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-content-muted">
              <Spinner className="size-4" />
              <span>Se așteaptă aprobarea{countdown ? ` · expiră în ${countdown}` : ''}</span>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-center text-sm text-danger-600">
                {error}
              </p>
            )}

            <Button
              variant="ghost"
              className="mt-6 w-full"
              onClick={() => startOver(null)}
            >
              Anulează
            </Button>
          </>
        )}

        {phase === 'done' && (
          <p className="my-10 text-center text-lg font-medium text-content">
            Sunteți înregistrat cu rol de{' '}
            {grantedRole ? ROLE_LABELS[grantedRole] : 'utilizator'}
          </p>
        )}
      </div>
    </div>
  );
}
