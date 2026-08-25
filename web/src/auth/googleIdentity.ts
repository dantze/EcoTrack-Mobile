/**
 * Google Identity Services (GIS) loader.
 *
 * Loaded lazily at runtime — a plain <script> injected on first use — rather
 * than an npm dependency or a permanent tag in index.html: most sessions
 * (anyone already holding a refresh token) never touch the Google button at
 * all, and mock mode never needs the real script (see LoginPage, which signs
 * the Google button in as a seeded demo user without calling any of this).
 *
 * We use GIS's own rendered button (`renderButton`) rather than driving
 * `prompt()` from a hand-rolled one: Google's One Tap prompt can silently
 * decline to show (e.g. the user dismissed it recently), which would leave a
 * "Continuă cu Google" button that does nothing on click. The rendered button
 * always opens the account chooser. `locale: 'ro'` plus `text: 'continue_with'`
 * is what makes Google itself render the Romanian "Continuă cu Google" copy,
 * so this still costs us zero English strings.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: GoogleIdConfig): void;
          renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
        };
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('gsi-load-failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('gsi-load-failed'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Loads GIS, initialises it with `clientId`, and renders the real Google
 * button into `container`. `onCredential` fires with the ID token to POST to
 * /auth/google. Rejects if the script cannot be loaded — LoginPage hides the
 * Google option in that case rather than leaving a dead button.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onCredential: (idToken: string) => void,
): Promise<void> {
  await loadScript();
  if (!window.google?.accounts?.id) throw new Error('gsi-unavailable');

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => onCredential(response.credential),
    // We drive sign-in from an explicit button click, not an automatic
    // One Tap prompt on page load.
    auto_select: false,
  });

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    locale: 'ro',
    width: 320,
  });
}
