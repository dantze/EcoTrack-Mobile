/**
 * Login screen — the app's one public route.
 *
 * Two ways in: username/password against POST /auth/login, or "Continuă cu
 * Google" against POST /auth/google. Both go through `useAuth().login` /
 * `loginWithGoogle`, which persist the session and flip `status` to
 * `authenticated` on success (see src/auth/AuthProvider.tsx) — this
 * component only owns the form, the Romanian error surface, and sending the
 * user back to wherever `RequireAuth` intercepted them from.
 *
 * The Google button is real GIS in live mode (hidden entirely when
 * VITE_GOOGLE_CLIENT_ID is unset, rather than rendering one that cannot
 * work) and a plain styled button in mock mode that signs in as a seeded
 * demo user without ever loading Google's script.
 */

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderGoogleButton, useAuth } from '@/auth';
import { Button, TextInput } from '@/components/ui';
import { MOCK_CREDENTIALS_HINT } from '@/api';
import { GOOGLE_CLIENT_ID, IS_MOCK } from '@/lib/config';

interface FieldErrors {
  username?: string;
  password?: string;
}

/** The mock /auth/google implementation never inspects this — any value signs in the demo account. */
const MOCK_DEMO_GOOGLE_TOKEN = 'mock-demo-token';

export function LoginPage() {
  const { login, loginWithGoogle, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const googleContainerRef = useRef<HTMLDivElement>(null);

  function redirectToOrigin() {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from;
    navigate(from?.pathname ?? '/', { replace: true });
  }

  // Already signed in — e.g. a bookmark to /login, or another tab logging in
  // while this one sat here. Bounce away rather than show a useless form.
  useEffect(() => {
    if (status === 'authenticated') redirectToOrigin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleGoogleCredential(idToken: string) {
    setGoogleSubmitting(true);
    setFormError(null);
    try {
      const result = await loginWithGoogle(idToken);
      if (result.success) redirectToOrigin();
      else setFormError(result.message ?? 'Autentificare eșuată.');
    } finally {
      setGoogleSubmitting(false);
    }
  }

  // Live mode: load GIS and render the real button once mounted. Never runs
  // in mock mode — the demo Google button below is a plain styled Button.
  useEffect(() => {
    if (IS_MOCK || !GOOGLE_CLIENT_ID) return;
    const container = googleContainerRef.current;
    if (!container) return;
    let cancelled = false;

    renderGoogleButton(container, GOOGLE_CLIENT_ID, (idToken) => void handleGoogleCredential(idToken))
      .then(() => {
        if (!cancelled) setGoogleReady(true);
      })
      .catch(() => {
        // Script blocked/offline — hide the option rather than leave a dead button.
        if (!cancelled) setGoogleReady(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = 'Introdu numele de utilizator.';
    if (!password) errors.password = 'Introdu parola.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await login(username.trim(), password);
      if (result.success) redirectToOrigin();
      else setFormError(result.message ?? 'Autentificare eșuată.');
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || googleSubmitting;
  const showGoogleSection = IS_MOCK || Boolean(GOOGLE_CLIENT_ID);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-700 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-white p-7 shadow-modal ring-1 ring-black/5">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold text-ink">EcoTrack</p>
          <p className="text-sm text-ink-muted">Autentificare</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Utilizator"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            error={fieldErrors.username}
            disabled={busy}
          />
          <TextInput
            label="Parolă"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            disabled={busy}
          />

          {formError && (
            <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {formError}
            </p>
          )}

          <Button type="submit" variant="primary" block loading={submitting} disabled={busy}>
            Autentificare
          </Button>
        </form>

        {showGoogleSection && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="text-xs text-ink-subtle">sau</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>

            {IS_MOCK ? (
              <Button
                type="button"
                variant="secondary"
                block
                loading={googleSubmitting}
                disabled={busy}
                onClick={() => void handleGoogleCredential(MOCK_DEMO_GOOGLE_TOKEN)}
              >
                Continuă cu Google
              </Button>
            ) : (
              <div ref={googleContainerRef} className={googleReady ? 'flex justify-center' : 'hidden'} />
            )}
          </>
        )}

        {IS_MOCK && (
          <p className="mt-5 text-center text-xs text-ink-subtle">
            Date demo: {MOCK_CREDENTIALS_HINT.username} / {MOCK_CREDENTIALS_HINT.password}
          </p>
        )}
      </div>
    </div>
  );
}
