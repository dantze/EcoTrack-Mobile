/**
 * The mock implementation must satisfy `EcoTrackApi` *behaviourally*, not just
 * structurally.
 *
 * CLAUDE.md: `src/api/contract.ts` defines the contract and both `src/api/live/`
 * and `src/mocks/` satisfy it exactly; `src/api/index.ts` swaps between them at
 * build time. TypeScript already proves the SHAPES match — what it cannot prove
 * is that the mock behaves like a service: that a write is visible to the next
 * read, that deletes cascade the way the backend cascades, and that the error
 * cases the UI has to handle actually throw.
 *
 * That behavioural half is what this file covers, because mock is the DEFAULT
 * data mode: every demo, every screenshot and most development runs against it.
 *
 * Note on isolation: `db` in src/mocks/store.ts is a module-level singleton
 * seeded once per module registry. Vitest isolates modules per test file, so
 * this file gets a fresh seed — but tests within it share one database. Each
 * test below therefore creates the rows it needs rather than assuming a
 * pristine store, and the ordering-sensitive ones assert deltas, not totals.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { mockApi, DEV_DEVICE_ID } from '@/mocks';
import { MockApiError } from '@/mocks/store';
import { SubscriptionInUseError } from '@/api/errors';
import type { EcoTrackApi } from '@/api/contract';
import { setAccessToken } from '@/auth/tokenBridge';

// The one assertion TypeScript makes for us — kept explicit so a contract
// method added without a mock counterpart is a compile error in THIS file,
// where it reads as a failing test rather than a mysterious error elsewhere.
const api: EcoTrackApi = mockApi;

/** Every resource group the contract promises. */
const RESOURCES = [
  'auth',
  'clients',
  'orders',
  'products',
  'subscriptions',
  'employees',
  'routes',
  'tasks',
  'recurring',
] as const;

describe('mock API surface', () => {
  it('exposes every resource group in the contract', () => {
    for (const resource of RESOURCES) {
      expect(api[resource], `mockApi.${resource}`).toBeDefined();
    }
  });

  it('exposes every method of each resource group as a function', () => {
    for (const resource of RESOURCES) {
      const group = api[resource] as unknown as Record<string, unknown>;
      for (const [name, value] of Object.entries(group)) {
        expect(typeof value, `mockApi.${resource}.${name}`).toBe('function');
      }
    }
  });

  it('returns promises, so loading states are genuinely exercised', async () => {
    const pending = api.clients.list();
    expect(pending).toBeInstanceOf(Promise);
    await pending;
  });
});

// ---------------------------------------------------------------------------
// Auth — the token handshake the live backend performs
// ---------------------------------------------------------------------------

describe('enrollment + auth', () => {
  /** Drives the real request -> claim path the mock auto-approves for dev. */
  async function enrollDevDevice() {
    const ticket = await api.enrollment.request({
      fullName: 'Administrator',
      deviceId: DEV_DEVICE_ID,
      deviceLabel: 'Vitest',
    });
    expect(ticket.autoApproved).toBe(true);
    const claimed = await api.enrollment.claim(ticket.requestId, ticket.claimSecret);
    expect(claimed.state).toBe('issued');
    if (claimed.state !== 'issued') throw new Error('unreachable');
    return claimed.session;
  }

  it('issues an access + refresh pair once a request is approved', async () => {
    const session = await enrollDevDevice();

    expect(session.tokens.accessToken).toBeTruthy();
    expect(session.tokens.refreshToken).toBeTruthy();
    expect(session.tokens.expiresIn).toBeGreaterThan(0);
    expect(session.user.roles).toContain('ADMIN');
  });

  it('leaves an ordinary request pending until an admin decides', async () => {
    const ticket = await api.enrollment.request({
      fullName: 'Cineva Nou',
      deviceId: 'some-other-device',
    });
    expect(ticket.autoApproved).toBe(false);

    // 'pending' is an outcome, not an error — the waiting screen polls on it.
    const claimed = await api.enrollment.claim(ticket.requestId, ticket.claimSecret);
    expect(claimed.state).toBe('pending');
  });

  it('refuses a wrong claim secret without saying why', async () => {
    const ticket = await api.enrollment.request({
      fullName: 'Cineva Nou',
      deviceId: 'another-device',
    });

    // Unknown id and wrong secret answer identically on purpose: telling them
    // apart would confirm which request ids exist.
    const claimed = await api.enrollment.claim(ticket.requestId, 'not-the-secret');
    expect(claimed.state).toBe('unknown');
  });

  it('lets an admin approve a request, which then yields that role', async () => {
    const session = await enrollDevDevice();
    setAccessToken(session.tokens.accessToken);

    const ticket = await api.enrollment.request({
      fullName: 'Sofer Nou',
      deviceId: 'driver-device',
    });
    await api.enrollment.approve(ticket.requestId, 'DRIVER');

    const claimed = await api.enrollment.claim(ticket.requestId, ticket.claimSecret);
    expect(claimed.state).toBe('issued');
    if (claimed.state !== 'issued') throw new Error('unreachable');
    expect(claimed.session.user.roles).toContain('DRIVER');
  });

  it('never yields tokens for a rejected request', async () => {
    const session = await enrollDevDevice();
    setAccessToken(session.tokens.accessToken);

    const ticket = await api.enrollment.request({
      fullName: 'Respins',
      deviceId: 'rejected-device',
    });
    await api.enrollment.reject(ticket.requestId);

    const claimed = await api.enrollment.claim(ticket.requestId, ticket.claimSecret);
    expect(claimed.state).toBe('rejected');
  });

  it('never exposes the claim secret through the admin queue', async () => {
    const session = await enrollDevDevice();
    setAccessToken(session.tokens.accessToken);

    const rows = await api.enrollment.listRequests();
    for (const row of rows) {
      expect(row).not.toHaveProperty('claimSecret');
      expect(row.verificationCode).toMatch(/^\d{6}$/);
    }
  });

  it('rotates the refresh token, killing the old one — same as the live backend', async () => {
    const session = await enrollDevDevice();
    const first = session.tokens.refreshToken;

    const rotated = await api.auth.refresh(first);
    expect(rotated.refreshToken).not.toBe(first);
    expect(rotated.accessToken).toBeTruthy();

    // Reusing the retired token must fail.
    await expect(api.auth.refresh(first)).rejects.toBeInstanceOf(MockApiError);
  });

  it('me() requires an access token on the bridge, mirroring /auth/me', async () => {
    setAccessToken(null);
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });

    const session = await enrollDevDevice();
    setAccessToken(session.tokens.accessToken);

    const user = await api.auth.me();
    expect(user.roles).toContain('ADMIN');
  });

  it('logout is best-effort and never rejects, so callers can clear state regardless', async () => {
    await expect(api.auth.logout(null)).resolves.toBeUndefined();
    await expect(api.auth.logout('mock.refresh.999.garbage')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Reads return the domain shapes, not the internal rows
// ---------------------------------------------------------------------------

describe('seeded reads', () => {
  it('lists clients as tagged Individual | Company unions', async () => {
    const clients = await api.clients.list();

    expect(clients.length).toBeGreaterThan(0);
    for (const client of clients) {
      expect(['individual', 'company']).toContain(client.type);
      if (client.type === 'company') expect(typeof client.name).toBe('string');
      else expect(typeof client.fullName).toBe('string');
    }
  });

  it('lists orders as the three tagged order subtypes', async () => {
    const orders = await api.orders.list();

    expect(orders.length).toBeGreaterThan(0);
    for (const order of orders) {
      expect(['Amplasari', 'Ridicari', 'Igienizari']).toContain(order.orderType);
      // OrderBase promises a hydrated client on every order.
      expect(order.client).toBeTruthy();
      expect(typeof order.date).toBe('string');
    }
  });

  it('hydrates route.employee and route.tasks the way normalize.ts does for live', async () => {
    const routes = await api.routes.list();
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      expect(Array.isArray(route.tasks)).toBe(true);
      // tasks come back pre-sorted by orderIndex
      const indices = route.tasks.map((task) => task.orderIndex);
      expect([...indices].sort((a, b) => a - b)).toEqual(indices);
      // and the object graph stays acyclic
      expect(() => JSON.stringify(route)).not.toThrow();
    }
  });

  it('returns employees with upper-case role names', async () => {
    const employees = await api.employees.list();
    expect(employees.length).toBeGreaterThan(0);
    for (const employee of employees) {
      for (const role of employee.roles) expect(role).toBe(role.toUpperCase());
    }
  });

  it('listDrivers() is a subset of list() and every result actually holds DRIVER', async () => {
    const [all, drivers] = await Promise.all([api.employees.list(), api.employees.listDrivers()]);

    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers.length).toBeLessThanOrEqual(all.length);
    for (const driver of drivers) expect(driver.roles).toContain('DRIVER');
  });

  it('subscriptions.list() hides retired plans that listAll() still returns', async () => {
    const [active, all] = await Promise.all([
      api.subscriptions.list(),
      api.subscriptions.listAll(),
    ]);

    expect(all.length).toBeGreaterThanOrEqual(active.length);
    for (const subscription of active) expect(subscription.isActive).toBe(true);
  });

  it('404s on a missing id instead of resolving undefined', async () => {
    await expect(api.clients.get(999_999)).rejects.toMatchObject({ status: 404 });
    await expect(api.orders.get(999_999)).rejects.toMatchObject({ status: 404 });
    await expect(api.tasks.get(999_999)).rejects.toMatchObject({ status: 404 });
    await expect(api.routes.get(999_999)).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// Mutations really mutate
// ---------------------------------------------------------------------------

describe('writes are visible to subsequent reads', () => {
  it('creates a client that the next list() call returns', async () => {
    const before = await api.clients.list();

    const created = await api.clients.create({
      type: 'company',
      name: 'Test Contract SRL',
      CUI: 'RO99999999',
      email: 'contract@test.ro',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.type).toBe('company');

    const after = await api.clients.list();
    expect(after).toHaveLength(before.length + 1);
    expect(after.map((client) => client.id)).toContain(created.id);
    expect(await api.clients.get(created.id)).toMatchObject({ id: created.id });
  });

  it('updates a client in place', async () => {
    const created = await api.clients.create({ type: 'individual', fullName: 'Ion Test' });

    const updated = await api.clients.update(created.id, {
      type: 'individual',
      fullName: 'Ion Test Redenumit',
      phone: '0722999888',
    });

    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({ type: 'individual', fullName: 'Ion Test Redenumit' });
    expect(await api.clients.get(created.id)).toMatchObject({ fullName: 'Ion Test Redenumit' });
  });

  it('creates an order for a client and links it both ways', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Order Owner SRL' });
    const products = await api.products.list();

    const order = await api.orders.create(client.id, {
      orderType: 'Amplasari',
      product: { id: products[0]!.id },
      quantity: 3,
      locationAddress: 'Str. Test 5',
      locationCoordinates: '44.43,26.10',
    });

    expect(order.orderType).toBe('Amplasari');
    expect(order.client.id).toBe(client.id);
    if (order.orderType === 'Amplasari') {
      expect(order.quantity).toBe(3);
      expect(order.product?.id).toBe(products[0]!.id);
    }

    const forClient = await api.orders.listForClient(client.id);
    expect(forClient.map((entry) => entry.id)).toContain(order.id);
  });

  it('accepts a bare id as well as a nested {id} for an order reference', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Bare Id SRL' });
    const products = await api.products.list();

    // The backend binds `product` onto a JPA entity, so the UI sends `{id}` —
    // but the mock deliberately also accepts the bare form.
    const order = await api.orders.create(client.id, {
      orderType: 'Amplasari',
      product: products[0]!.id,
      quantity: 1,
    });

    if (order.orderType === 'Amplasari') expect(order.product?.id).toBe(products[0]!.id);
  });

  it('deletes an order', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Deletable SRL' });
    const order = await api.orders.create(client.id, { orderType: 'Amplasari', quantity: 1 });

    await api.orders.remove(order.id);

    await expect(api.orders.get(order.id)).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// Error cases the UI has to handle
// ---------------------------------------------------------------------------

describe('the failures the UI must render', () => {
  it('refuses to delete a client that still has orders (409)', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Has Orders SRL' });
    await api.orders.create(client.id, { orderType: 'Amplasari', quantity: 1 });

    expect(await api.clients.hasOrders(client.id)).toBe(true);
    await expect(api.clients.remove(client.id)).rejects.toMatchObject({ status: 409 });
  });

  it('hasOrders() is false for a client with none, and deletion then succeeds', async () => {
    const client = await api.clients.create({ type: 'company', name: 'No Orders SRL' });

    expect(await api.clients.hasOrders(client.id)).toBe(false);
    await expect(api.clients.remove(client.id)).resolves.toBeUndefined();
  });

  it('refuses to delete a product that is still referenced by an order (409)', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Product User SRL' });
    const product = await api.products.create({
      name: 'Produs Test',
      description: null,
      price: 100,
    });
    await api.orders.create(client.id, {
      orderType: 'Amplasari',
      product: { id: product.id },
      quantity: 1,
    });

    await expect(api.products.remove(product.id)).rejects.toMatchObject({ status: 409 });
  });

  it('allows deleting an unreferenced product', async () => {
    const product = await api.products.create({ name: 'Nefolosit', description: null, price: 10 });
    await expect(api.products.remove(product.id)).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Retiring a subscription is refused while live orders still use it.
  // Mirrors SubscriptionService.deactivate() — the UI branches on this class,
  // so the mock has to throw it too or mock mode cannot exercise the dialog.
  // -------------------------------------------------------------------------

  const isoDaysFromToday = (days: number): string => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const makePlan = () =>
    api.subscriptions.create({
      name: `Plan ${Math.random().toString(36).slice(2, 8)}`,
      description: null,
      type: 'ONE_TIME',
      price: 150,
      visitsPerMonth: null,
      durationMonths: null,
      isIndefinite: null,
      isActive: true,
    });

  it('refuses to retire a subscription an UNFULFILLED order still uses, and names it', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Abonat Viu SRL' });
    const plan = await makePlan();
    const order = await api.orders.create(client.id, {
      orderType: 'Igienizari',
      subscription: { id: plan.id },
      // Still ahead of us and no tasks yet: live work by any reading.
      sanitationDate: isoDaysFromToday(30),
    });

    await expect(api.subscriptions.remove(plan.id)).rejects.toBeInstanceOf(SubscriptionInUseError);

    // The refusal has to carry enough to LIST the blockers, not just count them.
    const error = await api.subscriptions
      .remove(plan.id)
      .then(() => null)
      .catch((thrown: unknown) => thrown as SubscriptionInUseError);
    expect(error?.message).toContain('Abonamentul nu poate fi șters');
    expect(error?.blockingOrders.map((blocker) => blocker.id)).toEqual([order.id]);
    expect(error?.blockingOrders[0]?.clientName).toBe('Abonat Viu SRL');

    // And nothing was retired.
    const all = await api.subscriptions.listAll();
    expect(all.find((entry) => entry.id === plan.id)?.isActive).toBe(true);
  });

  it('retires a subscription when only FULFILLED orders reference it', async () => {
    const client = await api.clients.create({ type: 'company', name: 'Abonat Istoric SRL' });
    const plan = await makePlan();
    await api.orders.create(client.id, {
      orderType: 'Igienizari',
      subscription: { id: plan.id },
      // A visit whose date is strictly behind us and that produced no tasks is
      // history — blocking on it would make the plan undeletable forever.
      sanitationDate: isoDaysFromToday(-30),
    });

    await expect(api.subscriptions.remove(plan.id)).resolves.toBeUndefined();
    const all = await api.subscriptions.listAll();
    expect(all.find((entry) => entry.id === plan.id)?.isActive).toBe(false);
  });

  it('retires a subscription nothing references at all', async () => {
    const plan = await makePlan();

    await expect(api.subscriptions.remove(plan.id)).resolves.toBeUndefined();
    const active = await api.subscriptions.list();
    expect(active.some((entry) => entry.id === plan.id)).toBe(false);
  });

  it('refuses a second task for the same order (409)', async () => {
    const client = await api.clients.create({ type: 'company', name: 'One Task SRL' });
    const order = await api.orders.create(client.id, {
      orderType: 'Amplasari',
      quantity: 1,
      locationAddress: 'Str. Task 1',
    });
    const routes = await api.routes.list();

    const task = await api.tasks.createFromOrder(order.id, routes[0]!.id);
    expect(task.id).toBeGreaterThan(0);

    await expect(api.tasks.createFromOrder(order.id, routes[0]!.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('statusForOrder() returns an OBJECT, not a boolean', async () => {
    // The contract calls this out explicitly: GET /tasks/order/{id}/exists
    // returns { hasTask, taskId, routeId, scheduledTime, status }.
    const client = await api.clients.create({ type: 'company', name: 'Status SRL' });
    const order = await api.orders.create(client.id, { orderType: 'Amplasari', quantity: 1 });

    const before = await api.tasks.statusForOrder(order.id);
    expect(before).toMatchObject({ hasTask: false, taskId: null });

    const routes = await api.routes.list();
    const task = await api.tasks.createFromOrder(order.id, routes[0]!.id);

    const after = await api.tasks.statusForOrder(order.id);
    expect(after.hasTask).toBe(true);
    expect(after.taskId).toBe(task.id);
    expect(after.routeId).toBe(routes[0]!.id);
  });
});

// ---------------------------------------------------------------------------
// Cascades — the mock claims to cascade the way the backend does
// ---------------------------------------------------------------------------

describe('cascades', () => {
  it('deleting a route unassigns its tasks rather than destroying them', async () => {
    const route = await api.routes.create({ name: 'Ruta Temporară', dayOfWeek: 1 });
    const client = await api.clients.create({ type: 'company', name: 'Cascade SRL' });
    const order = await api.orders.create(client.id, {
      orderType: 'Amplasari',
      quantity: 1,
      locationAddress: 'Str. Cascade 1',
    });
    const task = await api.tasks.createFromOrder(order.id, route.id);

    await api.routes.remove(route.id);

    const survivor = await api.tasks.get(task.id);
    expect(survivor.id).toBe(task.id);
    expect(survivor.route).toBeNull();
    await expect(api.routes.get(route.id)).rejects.toMatchObject({ status: 404 });
  });

  it('reassigning a task moves it onto the new route', async () => {
    const [from, to] = await Promise.all([
      api.routes.create({ name: 'Ruta A' }),
      api.routes.create({ name: 'Ruta B' }),
    ]);
    const client = await api.clients.create({ type: 'company', name: 'Reassign SRL' });
    const order = await api.orders.create(client.id, { orderType: 'Amplasari', quantity: 1 });
    const task = await api.tasks.createFromOrder(order.id, from.id);

    const moved = await api.tasks.reassign(task.id, to.id);

    expect(moved.route?.id).toBe(to.id);
    expect((await api.tasks.listForRoute(from.id)).map((t) => t.id)).not.toContain(task.id);
    expect((await api.tasks.listForRoute(to.id)).map((t) => t.id)).toContain(task.id);
  });

  it('reorderTasks() takes a bare array of ids and renumbers orderIndex from 0', async () => {
    const route = await api.routes.create({ name: 'Ruta Reorder' });
    const client = await api.clients.create({ type: 'company', name: 'Reorder SRL' });

    const ids: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const order = await api.orders.create(client.id, { orderType: 'Amplasari', quantity: 1 });
      ids.push((await api.tasks.createFromOrder(order.id, route.id)).id);
    }

    const reversed = [...ids].reverse();
    const updated = await api.routes.reorderTasks(route.id, reversed);

    expect(updated.tasks.map((task) => task.id)).toEqual(reversed);
    expect(updated.tasks.map((task) => task.orderIndex)).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Recurring plans
// ---------------------------------------------------------------------------

describe('recurring plans', () => {
  let clientId: number;

  beforeAll(async () => {
    clientId = (await api.clients.create({ type: 'company', name: 'Recurring SRL' })).id;
  });

  it('creates an active plan for a client', async () => {
    const plan = await api.recurring.create(clientId, {
      frequencyDays: 14,
      startDate: '2026-01-05',
      isIndefinite: true,
      sanitationLocationAddress: 'Str. Igienă 3',
    });

    expect(plan.active).toBe(true);
    expect(plan.frequencyDays).toBe(14);
    expect(plan.client.id).toBe(clientId);
    expect((await api.recurring.listForClient(clientId)).map((p) => p.id)).toContain(plan.id);
  });

  it('lists an unassigned plan as unassigned until a route is attached', async () => {
    const plan = await api.recurring.create(clientId, {
      startDate: '2026-02-05',
      isIndefinite: true,
    });

    expect((await api.recurring.listUnassigned()).map((p) => p.id)).toContain(plan.id);

    const route = await api.routes.create({ name: 'Ruta Recurring' });
    const assigned = await api.recurring.assignRoute(plan.id, route.id);

    expect(assigned.route?.id).toBe(route.id);
    expect((await api.recurring.listUnassigned()).map((p) => p.id)).not.toContain(plan.id);
  });

  it('deactivate() drops the plan out of listActive()', async () => {
    const plan = await api.recurring.create(clientId, {
      startDate: '2026-03-05',
      isIndefinite: true,
    });
    expect((await api.recurring.listActive()).map((p) => p.id)).toContain(plan.id);

    const deactivated = await api.recurring.deactivate(plan.id);

    expect(deactivated.active).toBe(false);
    expect((await api.recurring.listActive()).map((p) => p.id)).not.toContain(plan.id);
  });
});
