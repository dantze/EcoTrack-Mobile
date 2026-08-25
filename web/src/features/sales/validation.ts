/**
 * Form validation for the Sales module.
 *
 * Ported 1:1 from the mobile app so the desktop rewrite rejects exactly the
 * same input:
 *   - frontend/utils/validation.ts   (isValidEmail, isValidPhoneDigits)
 *   - frontend/utils/formatters.ts   (validateRequired / PositiveNumber / PositiveInt)
 * Messages stay in Romanian and keep the original wording.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Basic XX@XX.XX pattern, same as the mobile app. */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Digits only, 4–15 of them — the mobile rule for the national part. */
export function isValidPhoneDigits(phone: string): boolean {
  return /^\d{4,15}$/.test(phone.trim());
}

export function validateRequired(value: string, fieldLabel: string): string | null {
  return value.trim() ? null : `${fieldLabel} este obligatoriu.`;
}

/** Romanian keyboards type "12,5"; the API wants 12.5. */
export function normaliseDecimal(value: string): string {
  return value.trim().replace(',', '.');
}

export function parseDecimal(value: string): number {
  return Number.parseFloat(normaliseDecimal(value));
}

export function validatePositiveNumber(value: string, fieldLabel: string): string | null {
  const parsed = parseDecimal(value);
  if (!value.trim() || Number.isNaN(parsed) || parsed < 0) {
    return `${fieldLabel} trebuie să fie un număr valid pozitiv.`;
  }
  return null;
}

export function validatePositiveInt(value: string, fieldLabel: string): string | null {
  const parsed = Number.parseInt(value, 10);
  if (!value.trim() || Number.isNaN(parsed) || parsed < 1) {
    return `${fieldLabel} trebuie să fie un număr întreg valid (min. 1).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phone numbers — stored as "<country code><digits>", e.g. "+40730712100"
// ---------------------------------------------------------------------------

/** Subset of the mobile app's EUROPEAN_COUNTRIES, longest code first matters. */
export const PHONE_CODES = [
  '+40',
  '+30',
  '+31',
  '+32',
  '+33',
  '+34',
  '+36',
  '+39',
  '+41',
  '+43',
  '+44',
  '+45',
  '+48',
  '+49',
  '+351',
  '+352',
  '+353',
  '+355',
  '+357',
  '+358',
  '+359',
  '+370',
  '+371',
  '+372',
  '+373',
  '+380',
  '+381',
  '+385',
  '+386',
  '+420',
  '+421',
  '+423',
] as const;

export const DEFAULT_PHONE_CODE = '+40';

export interface SplitPhone {
  code: string;
  digits: string;
}

/**
 * Splits a stored phone into dialling code + national digits.
 * Mirrors EditClient.parsePhone: known codes first (longest match), then the
 * legacy Romanian local format 07XXXXXXXX → +40 7XXXXXXXX.
 */
export function splitPhone(raw: string | null | undefined): SplitPhone {
  if (!raw) return { code: DEFAULT_PHONE_CODE, digits: '' };
  const normalised = raw.replace(/[^+\d]/g, '');
  const byLength = [...PHONE_CODES].sort((a, b) => b.length - a.length);
  for (const code of byLength) {
    if (normalised.startsWith(code)) {
      return { code, digits: normalised.slice(code.length) };
    }
  }
  if (!normalised.startsWith('00') && normalised.startsWith('0')) {
    return { code: DEFAULT_PHONE_CODE, digits: normalised.slice(1) };
  }
  return { code: DEFAULT_PHONE_CODE, digits: normalised.replace(/\+/g, '') };
}

export function joinPhone(code: string, digits: string): string {
  return `${code}${digits.trim()}`;
}

// ---------------------------------------------------------------------------
// Failed-submit focus
// ---------------------------------------------------------------------------

/**
 * Moves focus to the first field named in `errors`, keyed by that field's DOM
 * `id` — a failed submit should land the cursor on the problem, not just toast
 * about it. Only reaches `TextInput`/`TextArea` fields: `Select` and
 * `DateInput` do not accept an explicit `id` from the UI kit today, so a key
 * that names one of those simply finds no element and no-ops. The inline error
 * text under the field still renders either way.
 *
 * Reads through `Object.entries` (rather than typing the parameter as
 * `Record<string, string | undefined>` directly) so callers can pass their own
 * named `Errors` interface without needing an index signature on it.
 */
export function focusFirstInvalidField(errors: object): void {
  const [key] = Object.entries(errors).find(
    ([, message]) => typeof message === 'string' && message,
  ) ?? [];
  if (!key) return;
  requestAnimationFrame(() => {
    document.getElementById(key)?.focus();
  });
}
