/**
 * `isOrderFulfilled` — the one definition of "this order's work is finished",
 * shared by the Arhivă split (TODO-21) and, on the backend, by the guard that
 * refuses to retire a subscription live orders still point at (TODO-20).
 *
 * The rule has to fail safe in both places: only a COMPLETED task retires an
 * order. Everything else — no task, an unloaded status, work in progress —
 * keeps it in front of the operator.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { summariseOrderTasks } from '@/mocks';
import type { TaskRow } from '@/mocks/store';
import type { TaskStatus } from '@/types/domain';
import { isOrderFulfilled } from '../orderModel';

describe('isOrderFulfilled', () => {
  it('is true only for a COMPLETED task', () => {
    expect(isOrderFulfilled('COMPLETED')).toBe(true);
    expect(isOrderFulfilled('IN_PROGRESS')).toBe(false);
    expect(isOrderFulfilled('NEW')).toBe(false);
  });

  it('treats an order with no task as unfinished — the date does not decide', () => {
    // `null` is what `useOrderTaskStatuses` stores for an order with no task.
    // A past date makes such an order 'done' to the map's deriveLifecycle; here
    // it must stay current, because nobody ever carried it out.
    expect(isOrderFulfilled(null)).toBe(false);
  });

  it('treats a status that has not loaded as unfinished', () => {
    // An order is only ever hidden from Comenzi on positive evidence: a failed
    // or in-flight status lookup must not archive it.
    expect(isOrderFulfilled(undefined)).toBe(false);
  });
});

/**
 * The golden fixture (TODO-41).
 *
 * The rule is written three times — this pure function, the mock's roll-up, and
 * the backend's JPQL plus TaskService.summariseOrderTasks — in two languages,
 * with no shared code and no way to import each other. TODO-40's doc_claims.py
 * pins that they keep NAMING each other; `shared/fulfilment-cases.json` is what
 * pins that they still AGREE, and
 * backend/src/test/java/com/example/damiProd/RepositoryTests/FulfilmentRuleTest.java
 * reads the very same file. A case added there fails whichever side does not
 * follow it.
 */
interface GoldenCase {
  name: string;
  taskStatuses: string[];
  summarisedStatus: string | null;
  fulfilled: boolean;
  backendOnly?: boolean;
}

const fixture = JSON.parse(readFileSync('../shared/fulfilment-cases.json', 'utf8')) as {
  cases: GoldenCase[];
};

/** Every task unscheduled, as the fixture specifies: no date may decide this. */
function rows(statuses: string[]): TaskRow[] {
  return statuses.map(
    (status, index) => ({ id: index + 1, status, scheduledTime: null }) as TaskRow,
  );
}

describe('shared/fulfilment-cases.json', () => {
  it('is not silently empty — the whole guard would pass vacuously', () => {
    expect(fixture.cases.length).toBeGreaterThan(5);
  });

  // CANCELLED exists only in the backend's TaskStatus enum (as
  // cross_project_invariants.py declares), so the web app has no name for those
  // cases. The backend suite runs the whole file, including them.
  const webCases = fixture.cases.filter((entry) => !entry.backendOnly);

  it.each(webCases)('$name — summarises to the fixture status', (entry) => {
    const summary = summariseOrderTasks(rows(entry.taskStatuses));
    expect(summary?.status ?? null).toBe(entry.summarisedStatus);
  });

  it.each(webCases)('$name — is archived exactly when the fixture says', (entry) => {
    expect(isOrderFulfilled(entry.summarisedStatus as TaskStatus | null)).toBe(entry.fulfilled);
  });
});
