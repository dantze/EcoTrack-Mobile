/**
 * The web half of the shared order-lifecycle contract.
 *
 * `orderLifecycle.ts` and `backend/.../service/OrderFulfilmentPolicy.java` are a
 * deliberate mirror pair with NO reference between them — one is TypeScript,
 * one is Java, and neither toolchain can see the other. This file and its
 * backend twin (`OrderFulfilmentPolicySharedCasesTest`) both read
 * `shared/order-lifecycle-cases.json`, so a rule change that lands in only one
 * implementation fails the other's build.
 *
 * `orderLifecycle.test.ts` keeps the hand-written cases that document intent.
 * This one exists purely to be un-driftable.
 *
 * The fixture is read with `fs` rather than imported: it lives OUTSIDE
 * `web/`, and a static import would depend on Vite's fs-allow list rather than
 * on the file simply being there.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { deriveLifecycleFromTasks, isFulfilled, summarizeTaskStatus } from '@/lib/orderLifecycle';
import type { Lifecycle } from '@/lib/orderLifecycle';
import type { Order, Task, TaskStatus } from '@/types/domain';

const FIXTURE = 'shared/order-lifecycle-cases.json';

interface SharedCase {
  name: string;
  today?: string;
  order: Record<string, unknown> & { orderType: string };
  tasks: TaskStatus[];
  lifecycle: Lifecycle;
  fulfilled: boolean;
}

/**
 * Gradle and Vitest run from different working directories, so walk up to the
 * repo root instead of hardcoding a relative depth that breaks the moment this
 * file moves.
 */
function locateFixture(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const candidate = join(dir, FIXTURE);
      return readFileSync(candidate, 'utf8');
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(`could not find ${FIXTURE} — the shared contract is missing, not merely failing`);
}

const fixture = JSON.parse(locateFixture()) as {
  today: string;
  cases: SharedCase[];
};

/**
 * Only the fields the rule actually reads are in the fixture; the rest of
 * `Order` is irrelevant to the derivation, so the cast is the honest shape
 * rather than fifty lines of unused scaffolding per case.
 */
const asOrder = (raw: SharedCase['order']): Order => raw as unknown as Order;
const asTasks = (statuses: TaskStatus[]): Task[] =>
  statuses.map((status) => ({ status }) as Task);

describe(`shared order-lifecycle contract (${FIXTURE})`, () => {
  it('loads cases — a fixture that stopped being read would pass while guarding nothing', () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))(
    '%s',
    (_name, testCase) => {
      const order = asOrder(testCase.order);
      const tasks = asTasks(testCase.tasks);
      const today = testCase.today ?? fixture.today;

      expect(deriveLifecycleFromTasks(order, tasks, today)).toBe(testCase.lifecycle);

      // The boolean the backend mirrors. Asserted separately from the
      // lifecycle so a disagreement names which half drifted.
      expect(isFulfilled(order, summarizeTaskStatus(tasks), today)).toBe(testCase.fulfilled);
    },
  );

  it('every case keeps fulfilled and lifecycle consistent', () => {
    // Guards the fixture itself: `fulfilled` must be exactly
    // `lifecycle === 'done'`, or the two suites would be asserting different
    // rules from one file and both could pass.
    for (const testCase of fixture.cases) {
      expect(testCase.fulfilled, testCase.name).toBe(testCase.lifecycle === 'done');
    }
  });
});
