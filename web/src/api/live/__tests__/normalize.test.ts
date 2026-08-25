/**
 * Tests for the wire → domain normalisers.
 *
 * CLAUDE.md: "If you change an entity's JSON shape in the backend,
 * `normalize.ts` is where the web app breaks." This suite is the alarm for
 * that. Every payload below is written to match what the Spring controllers
 * ACTUALLY serialise — the shapes were read off the entities, not invented:
 *
 *   - Task/Route/Order associations are `@JsonIgnore`d and replaced by
 *     transient `…Id` / `…Name` getters, so a raw task has `routeId`, never
 *     `route`.
 *   - `/api/employees` returns the JPA entity, whose roles are
 *     `{ id, roleName }` OBJECTS. `/api/admin/employees` returns
 *     `EmployeeResponse`, whose roles are plain STRINGS. Both must land on the
 *     same `Employee`.
 *   - `Order.date` is a `java.util.Date`.
 *
 * A backend change that renames or re-shapes any of these fails here rather
 * than silently rendering empty cells in production.
 */

import { describe, expect, it } from 'vitest';
import {
  extractUrl,
  normalizeClient,
  normalizeEmployee,
  normalizeOrder,
  normalizePhotoUrls,
  normalizeProduct,
  normalizeRecurring,
  normalizeRoles,
  normalizeRoute,
  normalizeSubscription,
  normalizeTask,
  num,
  optBool,
  optNum,
  optStr,
  shallowRoute,
  toIsoInstant,
  type RawEmployee,
  type RawOrder,
  type RawRoute,
  type RawTask,
  type Relations,
} from '../normalize';
import type { Employee, Route } from '@/types/domain';

// ---------------------------------------------------------------------------
// Scalar coercion
// ---------------------------------------------------------------------------

describe('scalar coercion', () => {
  it('num() falls back rather than producing NaN', () => {
    expect(num(7)).toBe(7);
    expect(num('7')).toBe(7);
    expect(num(undefined)).toBe(0);
    expect(num(null)).toBe(0);
    expect(num('not a number')).toBe(0);
    expect(num('not a number', -1)).toBe(-1);
    // A NaN leaking into orderIndex would break the drag-to-reorder sort.
    expect(Number.isNaN(num('x'))).toBe(false);
  });

  it('optNum() distinguishes "absent" from zero', () => {
    expect(optNum(0)).toBe(0);
    expect(optNum('0')).toBe(0);
    expect(optNum(null)).toBeNull();
    expect(optNum(undefined)).toBeNull();
    // Jackson omits nothing, but an empty form field arrives as "".
    expect(optNum('')).toBeNull();
    expect(optNum('abc')).toBeNull();
  });

  it('optStr() keeps empty strings but maps null/undefined to null', () => {
    expect(optStr('')).toBe('');
    expect(optStr('x')).toBe('x');
    expect(optStr(null)).toBeNull();
    expect(optStr(undefined)).toBeNull();
    expect(optStr(42)).toBe('42');
  });

  it('optBool() maps null/undefined to null, everything else through Boolean()', () => {
    expect(optBool(true)).toBe(true);
    expect(optBool(false)).toBe(false);
    expect(optBool(null)).toBeNull();
    expect(optBool(undefined)).toBeNull();
  });

  it('toIsoInstant() accepts both the ISO string and the epoch-millis form', () => {
    // Spring Boot disables WRITE_DATES_AS_TIMESTAMPS, so ISO is what arrives...
    expect(toIsoInstant('2026-03-15T09:00:00.000+00:00')).toBe('2026-03-15T09:00:00.000+00:00');
    // ...but a server-side ObjectMapper tweak would emit millis instead.
    expect(toIsoInstant(1_773_561_600_000)).toBe(new Date(1_773_561_600_000).toISOString());
    expect(toIsoInstant(null)).toBe(new Date(0).toISOString());
    expect(toIsoInstant('')).toBe(new Date(0).toISOString());
  });
});

// ---------------------------------------------------------------------------
// Employees — the two-shaped endpoint
// ---------------------------------------------------------------------------

describe('employees: /api/employees entity vs /api/admin/employees DTO', () => {
  /** What GET /api/employees really returns: the JPA entity. */
  const entityShape: RawEmployee = {
    id: 3,
    username: 'vasile',
    fullName: 'Vasile Șofer',
    phone: '0733111222',
    county: 'Ilfov',
    roles: [
      { id: 2, roleName: 'DRIVER' },
      { id: 3, roleName: 'TECH' },
    ],
  };

  /** What POST/PUT /api/admin/employees returns: EmployeeResponse. */
  const dtoShape: RawEmployee = {
    id: 3,
    username: 'vasile',
    fullName: 'Vasile Șofer',
    phone: '0733111222',
    county: 'Ilfov',
    roles: ['DRIVER', 'TECH'],
  };

  it('produces an identical Employee from either shape', () => {
    const fromEntity = normalizeEmployee(entityShape);
    const fromDto = normalizeEmployee(dtoShape);

    expect(fromEntity).toEqual(fromDto);
    expect(fromEntity).toEqual<Employee>({
      id: 3,
      username: 'vasile',
      fullName: 'Vasile Șofer',
      phone: '0733111222',
      county: 'Ilfov',
      roles: ['DRIVER', 'TECH'],
    });
  });

  it('normalizeRoles() upper-cases, so DataLoader seeding roles as "driver" still matches', () => {
    expect(normalizeRoles(['driver', 'Sales'])).toEqual(['DRIVER', 'SALES']);
    expect(normalizeRoles([{ id: 1, roleName: 'admin' }])).toEqual(['ADMIN']);
  });

  it('normalizeRoles() drops empty and malformed entries instead of yielding ""', () => {
    // An EmployeeRole row with a null roleName would otherwise become a role
    // named "" that every hasRole() check silently fails against.
    expect(normalizeRoles([{ id: 1 }, '', 'DRIVER'])).toEqual(['DRIVER']);
    expect(normalizeRoles(null)).toEqual([]);
    expect(normalizeRoles(undefined)).toEqual([]);
  });

  it('an employee with no roles at all normalises to an empty array, never undefined', () => {
    expect(normalizeEmployee({ id: 1 }).roles).toEqual([]);
    expect(normalizeEmployee({ id: 1 }).fullName).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

describe('clients', () => {
  it('normalises a company on the `type` discriminator', () => {
    const client = normalizeClient({
      id: 1,
      type: 'company',
      email: 'office@acme.ro',
      phone: '0311000111',
      address: 'Bd. Firmei 20',
      name: 'Acme SRL',
      CUI: 'RO12345678',
      adminName: 'Maria Ionescu',
    });

    expect(client).toEqual({
      id: 1,
      type: 'company',
      email: 'office@acme.ro',
      phone: '0311000111',
      address: 'Bd. Firmei 20',
      name: 'Acme SRL',
      CUI: 'RO12345678',
      adminName: 'Maria Ionescu',
    });
  });

  it('normalises an individual', () => {
    const client = normalizeClient({
      id: 2,
      type: 'individual',
      email: 'ion@example.ro',
      phone: '0722000111',
      address: 'Str. Persoanei 4',
      fullName: 'Ion Popescu',
      CNP: '1900101123456',
      idPhotoUrl: 'https://cdn.example/id.jpg',
    });

    expect(client).toMatchObject({
      type: 'individual',
      fullName: 'Ion Popescu',
      CNP: '1900101123456',
      idPhotoUrl: 'https://cdn.example/id.jpg',
    });
  });

  /**
   * ⚠ KNOWN MISMATCH, pinned deliberately.
   *
   * `Individual.CNP` has no `@JsonProperty("CNP")` on the backend (unlike
   * `Company.CUI`, which does), so Jackson bean-names it and the wire actually
   * carries LOWERCASE `cnp`. `RawClient` declares `CNP`, so against the real
   * backend an individual's CNP always normalises to null. The backend side of
   * this is pinned by
   * `backend/.../DomainTests/ClientJsonSubTypesTest#individualSerialisation_emitsLowercaseCnpOnly`.
   *
   * Fixing it means changing BOTH sides at once. Until then this test states
   * the loss out loud instead of leaving it as a mysterious empty field.
   */
  it('LOSES an individual CNP that arrives under the real lowercase wire name', () => {
    const client = normalizeClient({
      id: 2,
      type: 'individual',
      fullName: 'Ion Popescu',
      // this is what Spring actually sends:
      cnp: '1900101123456',
    } as never);

    expect(client).toMatchObject({ type: 'individual', fullName: 'Ion Popescu', CNP: null });
  });

  it('falls through to individual for any non-company discriminator, including a missing one', () => {
    expect(normalizeClient({ id: 9 })).toMatchObject({ type: 'individual', fullName: '' });
    expect(normalizeClient({ id: 9, type: 'ngo' } as never)).toMatchObject({ type: 'individual' });
  });
});

// ---------------------------------------------------------------------------
// Products & subscriptions
// ---------------------------------------------------------------------------

describe('products and subscriptions', () => {
  it('normalises a product', () => {
    expect(normalizeProduct({ id: 4, name: 'Toaletă Standard', description: null, price: 500 }))
      .toEqual({ id: 4, name: 'Toaletă Standard', description: null, price: 500 });
  });

  it('treats a missing isActive as active, because the column defaults to true server-side', () => {
    expect(normalizeSubscription({ id: 5, name: 'Plan Lunar', type: 'RECURRING' }).isActive).toBe(true);
    expect(normalizeSubscription({ id: 5, isActive: false } as never).isActive).toBe(false);
  });

  it('defaults an absent subscription type to ONE_TIME', () => {
    expect(normalizeSubscription({ id: 5 }).type).toBe('ONE_TIME');
  });
});

// ---------------------------------------------------------------------------
// Orders — @JsonSubTypes dispatch on the wire
// ---------------------------------------------------------------------------

describe('orders', () => {
  const clientOnTheWire = { id: 1, type: 'company', name: 'Acme SRL', CUI: 'RO1' } as const;

  it('dispatches an Amplasari payload onto the placement fields', () => {
    const raw: RawOrder = {
      id: 10,
      number: 1001,
      date: '2026-03-15T09:00:00.000+00:00',
      orderType: 'Amplasari',
      client: clientOnTheWire,
      contact: 'Ion Pop',
      details: 'cod poartă 1234',
      product: { id: 4, name: 'Toaletă Standard', price: 500 },
      quantity: 3,
      isIndefinite: false,
      durationDays: 30,
      startDate: '2026-03-20',
      endDate: '2026-04-19',
      locationCoordinates: '44.43,26.10',
      locationAddress: 'Str. Amplasare 1',
      igienizariPerMonth: 2,
    };

    const order = normalizeOrder(raw);

    expect(order.orderType).toBe('Amplasari');
    expect(order).toMatchObject({
      id: 10,
      number: 1001,
      contact: 'Ion Pop',
      quantity: 3,
      locationCoordinates: '44.43,26.10',
      igienizariPerMonth: 2,
    });
    expect(order.client).toMatchObject({ type: 'company', name: 'Acme SRL' });
    if (order.orderType === 'Amplasari') {
      expect(order.product).toMatchObject({ id: 4, name: 'Toaletă Standard' });
    }
  });

  it('dispatches a Ridicari payload and keeps the denormalised product name', () => {
    const order = normalizeOrder({
      id: 11,
      number: 1002,
      date: 1_773_561_600_000,
      orderType: 'Ridicari',
      client: clientOnTheWire,
      pickupDate: '2026-04-01',
      pickupQuantity: 2,
      pickupProductName: 'Toaletă Standard',
      pickupLocationAddress: 'Str. Ridicare 9',
      pickupLocationCoordinates: '44.40,26.05',
    });

    expect(order.orderType).toBe('Ridicari');
    if (order.orderType === 'Ridicari') {
      expect(order.pickupQuantity).toBe(2);
      expect(order.pickupProductName).toBe('Toaletă Standard');
      // a Ridicare with no `product` association still normalises cleanly
      expect(order.product).toBeNull();
    }
    expect(order.date).toBe(new Date(1_773_561_600_000).toISOString());
  });

  it('dispatches an Igienizari payload and resolves recurringPlanId through relations', () => {
    const plan = normalizeRecurring({
      id: 77,
      client: clientOnTheWire,
      frequencyDays: 30,
      startDate: '2026-01-05',
      isIndefinite: true,
      active: true,
    });

    const relations: Relations = { plans: new Map([[77, plan]]) };

    const order = normalizeOrder(
      {
        id: 12,
        number: 1003,
        date: '2026-03-15T09:00:00.000+00:00',
        orderType: 'Igienizari',
        client: clientOnTheWire,
        subscription: { id: 5, name: 'Plan Lunar', type: 'RECURRING', price: 200 },
        sanitationDate: '2026-03-20',
        sanitationLocationAddress: 'Str. Igienă 3',
        sanitationLocationCoordinates: '44.41,26.06',
        // the association itself is @JsonIgnore — only the transient id survives
        recurringPlanId: 77,
      },
      relations,
    );

    expect(order.orderType).toBe('Igienizari');
    if (order.orderType === 'Igienizari') {
      expect(order.subscription).toMatchObject({ id: 5, name: 'Plan Lunar' });
      expect(order.recurringPlan?.id).toBe(77);
    }
  });

  it('leaves recurringPlan null when the plan is not in the relation map', () => {
    const order = normalizeOrder({
      id: 13,
      orderType: 'Igienizari',
      client: clientOnTheWire,
      recurringPlanId: 77,
    });
    if (order.orderType === 'Igienizari') expect(order.recurringPlan).toBeNull();
  });

  it('defaults an unknown or missing orderType to Amplasari', () => {
    // Deliberate: the backend rejects unmapped order types outright, so anything
    // that reaches here is a shape drift, and placement is the least-surprising
    // rendering. Pinned so a future change to reject instead is a visible choice.
    expect(normalizeOrder({ id: 14 }).orderType).toBe('Amplasari');
    expect(normalizeOrder({ id: 14, orderType: 'Reparatii' } as never).orderType).toBe('Amplasari');
  });

  it('survives an order whose client association came back null', () => {
    const order = normalizeOrder({ id: 15, orderType: 'Amplasari', client: null });
    expect(order.client).toMatchObject({ id: 0, type: 'individual', fullName: '' });
  });
});

// ---------------------------------------------------------------------------
// Tasks & routes — the transient-getter shapes
// ---------------------------------------------------------------------------

describe('tasks and routes', () => {
  const driver: Employee = {
    id: 3,
    username: 'vasile',
    fullName: 'Vasile Șofer',
    phone: '0733',
    county: 'Ilfov',
    roles: ['DRIVER'],
  };

  const rawTask: RawTask = {
    id: 20,
    type: 'SANITIZATION',
    scheduledTime: '2026-05-04T08:00:00',
    scheduledDate: '2026-05-04',
    status: 'IN_PROGRESS',
    address: 'Str. Igienă 3',
    coordinates: '44.41,26.06',
    clientName: 'Acme SRL',
    clientPhone: '0311',
    contactPerson: 'Ion Pop',
    productName: 'Plan Lunar',
    quantity: null,
    internalNotes: null,
    orderIndex: 2,
    routeId: 30,
    orderId: null,
    recurringPlanId: 77,
  };

  it('hydrates route/order/plan from the transient ids via the relation maps', () => {
    const route: Route = {
      id: 30,
      name: 'Ruta Nord',
      date: '2026-05-04',
      dayOfWeek: 1,
      county: 'Ilfov',
      employee: driver,
      tasks: [],
    };

    const task = normalizeTask(rawTask, { routes: new Map([[30, route]]) });

    expect(task.route?.id).toBe(30);
    expect(task.order).toBeNull();
    expect(task.status).toBe('IN_PROGRESS');
    expect(task.orderIndex).toBe(2);
    // a task payload never carries its photos — those are a separate call
    expect(task.photos).toEqual([]);
  });

  it('leaves route null when the relation map has no entry, rather than inventing one', () => {
    expect(normalizeTask(rawTask).route).toBeNull();
  });

  it('passes through backend enum values the domain union does not model', () => {
    // TaskStatus has CANCELLED and TaskType has MAINTENANCE server-side. Losing
    // the value would be worse than a label the UI cannot translate.
    const task = normalizeTask({ id: 1, status: 'CANCELLED', type: 'MAINTENANCE' });
    expect(task.status).toBe('CANCELLED');
    expect(task.type).toBe('MAINTENANCE');
  });

  it('defaults a missing status/type instead of producing undefined', () => {
    const task = normalizeTask({ id: 1 });
    expect(task.status).toBe('NEW');
    expect(task.type).toBe('PLACEMENT');
    expect(task.orderIndex).toBe(0);
  });

  it('normalizeRoute() sorts its tasks by orderIndex and back-links each to the route', () => {
    const raw: RawRoute = {
      id: 30,
      name: 'Ruta Nord',
      date: '2026-05-04',
      dayOfWeek: 1,
      county: 'Ilfov',
      employeeId: 3,
      employeeName: 'Vasile Șofer',
      tasks: [
        { id: 3, orderIndex: 2, routeId: 30 },
        { id: 1, orderIndex: 0, routeId: 30 },
        { id: 2, orderIndex: 1, routeId: 30 },
      ],
    };

    const route = normalizeRoute(raw, { employees: new Map([[3, driver]]) });

    expect(route.tasks.map((task) => task.id)).toEqual([1, 2, 3]);
    expect(route.employee).toEqual(driver);
    expect(route.tasks[0]?.route?.id).toBe(30);
  });

  it('keeps the task→route→tasks graph acyclic so TanStack structural sharing can walk it', () => {
    const route = normalizeRoute({
      id: 30,
      name: 'Ruta Nord',
      tasks: [{ id: 1, orderIndex: 0, routeId: 30 }],
    });

    expect(route.tasks).toHaveLength(1);
    // the route hung off the task must carry an EMPTY tasks array
    expect(route.tasks[0]?.route?.tasks).toEqual([]);
    expect(() => JSON.stringify(route)).not.toThrow();
  });

  it('falls back to the transient employeeName when the roster could not be fetched', () => {
    // Better a named driver with empty roles than no driver at all.
    const route = normalizeRoute({ id: 30, employeeId: 3, employeeName: 'Vasile Șofer' });
    expect(route.employee).toEqual({
      id: 3,
      username: '',
      fullName: 'Vasile Șofer',
      phone: null,
      county: null,
      roles: [],
    });
  });

  it('leaves employee null on an unassigned route', () => {
    expect(normalizeRoute({ id: 31, name: 'Ruta Sud' }).employee).toBeNull();
  });

  it('shallowRoute() copies the route and empties only its tasks', () => {
    const route: Route = {
      id: 30,
      name: 'Ruta Nord',
      date: null,
      dayOfWeek: null,
      county: null,
      employee: driver,
      tasks: [{ id: 1 } as never],
    };

    const shallow = shallowRoute(route);
    expect(shallow.tasks).toEqual([]);
    expect(shallow.employee).toBe(driver);
    expect(route.tasks).toHaveLength(1); // original untouched
  });
});

// ---------------------------------------------------------------------------
// Recurring plans
// ---------------------------------------------------------------------------

describe('recurring plans', () => {
  it('normalises a plan and defaults frequency to 30 days', () => {
    const plan = normalizeRecurring({
      id: 77,
      client: { id: 1, type: 'company', name: 'Acme SRL' },
      subscription: { id: 5, name: 'Plan Lunar', type: 'RECURRING' },
      startDate: '2026-01-05',
      isIndefinite: true,
      sanitationLocationAddress: 'Str. Igienă 3',
      active: true,
      lastGeneratedDate: '2026-04-05',
    });

    expect(plan.frequencyDays).toBe(30);
    expect(plan.isIndefinite).toBe(true);
    expect(plan.active).toBe(true);
    expect(plan.lastGeneratedDate).toBe('2026-04-05');
    expect(plan.route).toBeNull();
  });

  it('treats a missing active flag as active and a missing isIndefinite as false', () => {
    const plan = normalizeRecurring({ id: 78, client: { id: 1 } });
    expect(plan.active).toBe(true);
    expect(plan.isIndefinite).toBe(false);
  });

  it('shallows the nested route so the plan graph stays acyclic too', () => {
    const plan = normalizeRecurring({
      id: 79,
      client: { id: 1 },
      route: { id: 30, name: 'Ruta Nord', tasks: [{ id: 1, orderIndex: 0 }] },
    });

    expect(plan.route?.id).toBe(30);
    expect(plan.route?.tasks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Photos — the two odd endpoints
// ---------------------------------------------------------------------------

describe('photos', () => {
  it('synthesises ids for the bare URL list GET /tasks/{id}/photos returns', () => {
    expect(normalizePhotoUrls(['https://cdn/a.jpg', 'https://cdn/b.jpg'])).toEqual([
      { id: 1, url: 'https://cdn/a.jpg' },
      { id: 2, url: 'https://cdn/b.jpg' },
    ]);
  });

  it('also accepts object entries under either url or imageUrl', () => {
    expect(
      normalizePhotoUrls([
        { id: 9, url: 'https://cdn/a.jpg' },
        { imageUrl: 'https://cdn/b.jpg' },
      ]),
    ).toEqual([
      { id: 9, url: 'https://cdn/a.jpg' },
      { id: 2, url: 'https://cdn/b.jpg' },
    ]);
  });

  it('drops junk entries and tolerates a non-array response', () => {
    expect(normalizePhotoUrls([null, 42, {}])).toEqual([]);
    expect(normalizePhotoUrls(null)).toEqual([]);
    expect(normalizePhotoUrls('nope')).toEqual([]);
  });

  it('extractUrl() pulls the URL out of PhotosController plain-sentence response', () => {
    expect(
      extractUrl('Upload successful! Photo saved to client profile. URL: https://cdn/id.jpg'),
    ).toBe('https://cdn/id.jpg');
  });

  it('extractUrl() returns the whole message when there is no URL to find', () => {
    expect(extractUrl('Ceva nu a mers bine')).toBe('Ceva nu a mers bine');
  });
});
