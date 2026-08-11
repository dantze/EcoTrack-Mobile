/**
 * Placeholder implementation so the app typechecks and boots before the real
 * clients land. Every method throws on call; nothing throws on import, so
 * feature screens can be built and navigated against it.
 *
 * DELETE THIS FILE once both `src/api/live/` and `src/mocks/` are implemented.
 */

import type { EcoTrackApi } from './contract';

export function createStubApi(label: string): EcoTrackApi {
  const resource = (name: string) =>
    new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: unknown[]) => {
            throw new Error(
              `[${label}] ${name}.${String(method)}() is not implemented yet ` +
                `(called with ${args.length} arg(s))`,
            );
          },
      },
    );

  return new Proxy({} as EcoTrackApi, {
    get: (_target, name) => resource(String(name)),
  });
}
