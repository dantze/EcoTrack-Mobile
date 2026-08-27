import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Status is the DRIVER's report from the field.
 *
 * They mark "În curs" on arrival, and the task completes when they finish
 * uploading photos. The web app observes that; it must never write it — a
 * dispatcher setting status from the office would be recording work that may
 * not have happened. The backend enforces the same rule (TaskAccessPolicy
 * limits PATCH /tasks/{id}/status to the assigned driver).
 *
 * This is a source-level tripwire rather than a rendering test because the
 * control kept reappearing in new places: a drawer Select, a bulk picker, and
 * an inline table-cell editor were three separate writers. Catching the HOOK
 * catches all of them, including ones nobody has written yet.
 */
const STATUS_WRITE_HOOKS = ['useUpdateTaskStatus', 'useUpdateManyTaskStatuses'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('task status is read-only in the web app', () => {
  it('no feature component calls a status-write mutation', () => {
    const offenders = sourceFiles('src/features')
      .filter((file) => !file.endsWith('queries.ts'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return STATUS_WRITE_HOOKS.some((hook) => source.includes(hook));
      });

    expect(offenders).toEqual([]);
  });

  it('still exposes the mutations for mobile-facing code to use', () => {
    // Deliberately NOT deleted: status legitimately changes, just not from here.
    const queries = readFileSync('src/features/technical/queries.ts', 'utf8');
    for (const hook of STATUS_WRITE_HOOKS) {
      expect(queries).toContain(hook);
    }
  });
});
