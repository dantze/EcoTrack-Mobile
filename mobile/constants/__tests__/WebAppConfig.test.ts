import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveWebAppUrl } from '../WebAppConfig';

/**
 * The office signpost's address (TODO-84).
 *
 * The rule worth pinning is what happens when the variable is MISSING, because
 * that is the case the bug lived in: the address used to be derived from
 * `API_BASE_URL` by stripping `/api`, which since TODO-71 names the Cloud Run
 * backend rather than the Vercel SPA. Any fallback here re-opens that — the
 * screen must say it has no address instead of inventing a plausible one.
 */
describe('resolveWebAppUrl', () => {
    it('keeps a configured address', () => {
        expect(resolveWebAppUrl('https://ecotrack-web.vercel.app')).toBe(
            'https://ecotrack-web.vercel.app',
        );
    });

    it('drops a trailing slash, so the printed address is the one you would type', () => {
        expect(resolveWebAppUrl('https://ecotrack-web.vercel.app/')).toBe(
            'https://ecotrack-web.vercel.app',
        );
    });

    it('returns null when the variable is absent', () => {
        expect(resolveWebAppUrl(undefined)).toBeNull();
    });

    it('returns null for the empty string, which is how an unset CI variable arrives', () => {
        expect(resolveWebAppUrl('')).toBeNull();
        expect(resolveWebAppUrl('   ')).toBeNull();
    });

});

/**
 * The half a unit test cannot reach: the screen must not go back to computing
 * the address itself. Reintroducing `API_BASE_URL.replace(/\/api\/?$/, '')` in
 * office.tsx would type-check, lint clean and look right — and would silently
 * point office staff at Cloud Run again. Source scanning is the only thing that
 * catches a wrong-but-well-formed expression, which is the same argument
 * `web/src/components/ui/__tests__/colorTokensExist.test.ts` makes.
 */
describe('app/office.tsx', () => {
    it('takes the address from configuration, not from the API base', () => {
        const source = readFileSync(join(process.cwd(), 'app', 'office.tsx'), 'utf8');

        expect(source).toContain('WEB_APP_URL');
        expect(source).not.toContain('API_BASE_URL');
    });
});
