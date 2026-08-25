/**
 * Wire → domain normalisers for the live backend.
 *
 * The Spring entities do NOT serialise cleanly into `@/types/domain`. Several
 * associations are `@JsonIgnore`d and replaced by transient id/name getters,
 * and `/api/employees` returns the JPA entity (roles as objects) while
 * `/api/admin/employees` returns a DTO (roles as strings). Everything in this
 * module exists to paper over exactly those gaps, so the rest of `live/`
 * hands the feature layer the shapes `contract.ts` promises.
 *
 * Divergences handled here (see the report in the PR description):
 *   Task    — `route`, `order`, `photos`, `recurringPlan` are @JsonIgnore;
 *             the wire only carries `routeId` / `orderId` / `recurringPlanId`.
 *   Route   — `employee` is @JsonIgnore; wire carries `employeeId` +
 *             `employeeName`.
 *   Order   — `date` is a java.util.Date; `recurringPlan` is @JsonIgnore and
 *             only `recurringPlanId` survives.
 *   Employee— roles are `EmployeeRole` objects on /employees, plain strings on
 *             /admin/employees.
 */

import type {
  Client,
  Employee,
  Order,
  OrderTypeTag,
  Product,
  RecurringIgienizare,
  Role,
  Route,
  Subscription,
  Task,
  TaskPhoto,
  TaskStatus,
  TaskType,
} from '@/types/domain';

// ---------------------------------------------------------------------------
// Scalar coercion
// ---------------------------------------------------------------------------

export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function optStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : String(value);
}

export function optBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

/**
 * `Order.date` is a `java.util.Date`. Spring Boot's Jackson builder disables
 * WRITE_DATES_AS_TIMESTAMPS so it normally arrives as an ISO string, but an
 * ObjectMapper reconfigured server-side would emit epoch millis instead —
 * accept both.
 */
export function toIsoInstant(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string' && value !== '') return value;
  return new Date(0).toISOString();
}

/**
 * The backend enums are wider than the domain unions: `TaskStatus` also has
 * CANCELLED and `TaskType` also has MAINTENANCE. We pass the raw value through
 * rather than silently rewriting it — dropping data would be worse than a
 * label the UI does not know how to translate.
 */
function asTaskStatus(value: unknown): TaskStatus {
  return (optStr(value) ?? 'NEW') as TaskStatus;
}

function asTaskType(value: unknown): TaskType {
  return (optStr(value) ?? 'PLACEMENT') as TaskType;
}

// ---------------------------------------------------------------------------
// Raw wire shapes
// ---------------------------------------------------------------------------

export interface RawEmployeeRole {
  id?: number;
  roleName?: string;
}

export interface RawEmployee {
  id?: number;
  username?: string;
  fullName?: string;
  phone?: string | null;
  county?: string | null;
  /** Objects from /api/employees, plain strings from /api/admin/employees. */
  roles?: Array<string | RawEmployeeRole> | null;
}

export interface RawClient {
  id?: number;
  type?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  fullName?: string | null;
  CNP?: string | null;
  idPhotoUrl?: string | null;
  name?: string | null;
  CUI?: string | null;
  adminName?: string | null;
}

export interface RawProduct {
  id?: number;
  name?: string;
  description?: string | null;
  price?: number;
}

export interface RawSubscription {
  id?: number;
  name?: string;
  description?: string | null;
  type?: string;
  price?: number | null;
  visitsPerMonth?: number | null;
  durationMonths?: number | null;
  isIndefinite?: boolean | null;
  isActive?: boolean | null;
}

export interface RawOrder {
  id?: number;
  number?: number;
  date?: string | number | null;
  orderType?: string;
  client?: RawClient | null;
  contact?: string | null;
  details?: string | null;
  // Amplasare
  product?: RawProduct | null;
  quantity?: number | null;
  isIndefinite?: boolean | null;
  durationDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  locationCoordinates?: string | null;
  locationAddress?: string | null;
  igienizariPerMonth?: number | null;
  // Ridicare
  pickupDate?: string | null;
  pickupQuantity?: number | null;
  pickupProductName?: string | null;
  pickupLocationAddress?: string | null;
  pickupLocationCoordinates?: string | null;
  // Igienizare
  subscription?: RawSubscription | null;
  sanitationDate?: string | null;
  sanitationLocationAddress?: string | null;
  sanitationLocationCoordinates?: string | null;
  /** `recurringPlan` itself is @JsonIgnore — only the id is exposed. */
  recurringPlanId?: number | null;
}

export interface RawTask {
  id?: number;
  type?: string;
  scheduledTime?: string | null;
  scheduledDate?: string | null;
  status?: string;
  address?: string | null;
  coordinates?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  contactPerson?: string | null;
  productName?: string | null;
  quantity?: number | null;
  internalNotes?: string | null;
  orderIndex?: number | null;
  /** Transient getters — the associations themselves are @JsonIgnore. */
  routeId?: number | null;
  orderId?: number | null;
  recurringPlanId?: number | null;
}

export interface RawRoute {
  id?: number;
  name?: string;
  date?: string | null;
  dayOfWeek?: number | null;
  county?: string | null;
  /** Transient getters — `employee` itself is @JsonIgnore. */
  employeeId?: number | null;
  employeeName?: string | null;
  tasks?: RawTask[] | null;
}

export interface RawRecurring {
  id?: number;
  client?: RawClient | null;
  subscription?: RawSubscription | null;
  frequencyDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isIndefinite?: boolean | null;
  sanitationLocationAddress?: string | null;
  sanitationLocationCoordinates?: string | null;
  contact?: string | null;
  details?: string | null;
  route?: RawRoute | null;
  active?: boolean | null;
  lastGeneratedDate?: string | null;
}

// ---------------------------------------------------------------------------
// Relation lookup passed down through the normalisers
// ---------------------------------------------------------------------------

export interface Relations {
  routes?: Map<number, Route>;
  orders?: Map<number, Order>;
  employees?: Map<number, Employee>;
  plans?: Map<number, RecurringIgienizare>;
}

/** A route safe to hang off a task — the `tasks` array is emptied so the
 *  object graph stays acyclic (TanStack Query's structural sharing walks it). */
export function shallowRoute(route: Route): Route {
  return { ...route, tasks: [] };
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export function normalizeRoles(raw: RawEmployee['roles']): Role[] {
  if (!raw) return [];
  return raw
    .map((entry) => (typeof entry === 'string' ? entry : (entry?.roleName ?? '')))
    .filter((name): name is string => name.length > 0)
    .map((name) => name.toUpperCase() as Role);
}

export function normalizeEmployee(raw: RawEmployee): Employee {
  return {
    id: num(raw.id),
    username: raw.username ?? '',
    fullName: raw.fullName ?? '',
    phone: optStr(raw.phone),
    county: optStr(raw.county),
    roles: normalizeRoles(raw.roles),
  };
}

// ---------------------------------------------------------------------------
// Clients, products, subscriptions
// ---------------------------------------------------------------------------

export function normalizeClient(raw: RawClient): Client {
  const base = {
    id: num(raw.id),
    email: optStr(raw.email),
    phone: optStr(raw.phone),
    address: optStr(raw.address),
  };

  if (raw.type === 'company') {
    return {
      ...base,
      type: 'company',
      name: raw.name ?? '',
      CUI: optStr(raw.CUI),
      adminName: optStr(raw.adminName),
    };
  }

  return {
    ...base,
    type: 'individual',
    fullName: raw.fullName ?? '',
    CNP: optStr(raw.CNP),
    idPhotoUrl: optStr(raw.idPhotoUrl),
  };
}

export function normalizeProduct(raw: RawProduct): Product {
  return {
    id: num(raw.id),
    name: raw.name ?? '',
    description: optStr(raw.description),
    price: num(raw.price),
  };
}

export function normalizeSubscription(raw: RawSubscription): Subscription {
  return {
    id: num(raw.id),
    name: raw.name ?? '',
    description: optStr(raw.description),
    type: (raw.type ?? 'ONE_TIME') as Subscription['type'],
    price: optNum(raw.price),
    visitsPerMonth: optNum(raw.visitsPerMonth),
    durationMonths: optNum(raw.durationMonths),
    isIndefinite: optBool(raw.isIndefinite),
    // `isActive` defaults to true server-side; treat a missing flag as active.
    isActive: raw.isActive ?? true,
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export function normalizeOrder(raw: RawOrder, relations: Relations = {}): Order {
  const planId = optNum(raw.recurringPlanId);
  const base = {
    id: num(raw.id),
    number: num(raw.number),
    date: toIsoInstant(raw.date),
    client: normalizeClient(raw.client ?? {}),
    contact: optStr(raw.contact),
    details: optStr(raw.details),
  };

  const orderType = (raw.orderType ?? 'Amplasari') as OrderTypeTag;

  if (orderType === 'Ridicari') {
    return {
      ...base,
      orderType: 'Ridicari',
      product: raw.product ? normalizeProduct(raw.product) : null,
      pickupDate: optStr(raw.pickupDate),
      pickupQuantity: optNum(raw.pickupQuantity),
      pickupProductName: optStr(raw.pickupProductName),
      pickupLocationAddress: optStr(raw.pickupLocationAddress),
      pickupLocationCoordinates: optStr(raw.pickupLocationCoordinates),
    };
  }

  if (orderType === 'Igienizari') {
    return {
      ...base,
      orderType: 'Igienizari',
      subscription: raw.subscription ? normalizeSubscription(raw.subscription) : null,
      sanitationDate: optStr(raw.sanitationDate),
      sanitationLocationAddress: optStr(raw.sanitationLocationAddress),
      sanitationLocationCoordinates: optStr(raw.sanitationLocationCoordinates),
      recurringPlan: (planId !== null ? (relations.plans?.get(planId) ?? null) : null),
    };
  }

  return {
    ...base,
    orderType: 'Amplasari',
    product: raw.product ? normalizeProduct(raw.product) : null,
    quantity: optNum(raw.quantity),
    isIndefinite: optBool(raw.isIndefinite),
    durationDays: optNum(raw.durationDays),
    startDate: optStr(raw.startDate),
    endDate: optStr(raw.endDate),
    locationCoordinates: optStr(raw.locationCoordinates),
    locationAddress: optStr(raw.locationAddress),
    igienizariPerMonth: optNum(raw.igienizariPerMonth),
  };
}

// ---------------------------------------------------------------------------
// Tasks & routes
// ---------------------------------------------------------------------------

export function normalizeTask(
  raw: RawTask,
  relations: Relations = {},
  routeOverride?: Route | null,
): Task {
  const routeId = optNum(raw.routeId);
  const orderId = optNum(raw.orderId);
  const planId = optNum(raw.recurringPlanId);

  const route =
    routeOverride !== undefined
      ? routeOverride
      : routeId !== null
        ? (relations.routes?.get(routeId) ?? null)
        : null;

  return {
    id: num(raw.id),
    type: asTaskType(raw.type),
    scheduledTime: optStr(raw.scheduledTime),
    scheduledDate: optStr(raw.scheduledDate),
    status: asTaskStatus(raw.status),
    address: optStr(raw.address),
    coordinates: optStr(raw.coordinates),
    clientName: optStr(raw.clientName),
    clientPhone: optStr(raw.clientPhone),
    contactPerson: optStr(raw.contactPerson),
    productName: optStr(raw.productName),
    quantity: optNum(raw.quantity),
    internalNotes: optStr(raw.internalNotes),
    orderIndex: num(raw.orderIndex),
    route: route ? shallowRoute(route) : null,
    order: orderId !== null ? (relations.orders?.get(orderId) ?? null) : null,
    // GET /tasks/{id}/photos is a separate call returning bare URLs; a task
    // payload never carries its photos.
    photos: [],
    recurringPlan: planId !== null ? (relations.plans?.get(planId) ?? null) : null,
  };
}

export function normalizeRoute(raw: RawRoute, relations: Relations = {}): Route {
  const employeeId = optNum(raw.employeeId);
  const hydrated = employeeId !== null ? relations.employees?.get(employeeId) : undefined;

  // Fall back to the transient employeeName when the employee roster could not
  // be fetched — better a named driver with empty roles than no driver at all.
  const employee: Employee | null =
    hydrated ??
    (employeeId !== null
      ? {
          id: employeeId,
          username: '',
          fullName: raw.employeeName ?? '',
          phone: null,
          county: null,
          roles: [],
        }
      : null);

  const self: Route = {
    id: num(raw.id),
    name: raw.name ?? '',
    date: optStr(raw.date),
    dayOfWeek: optNum(raw.dayOfWeek),
    county: optStr(raw.county),
    employee,
    tasks: [],
  };

  const tasks = (raw.tasks ?? [])
    .map((task) => normalizeTask(task, relations, self))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return { ...self, tasks };
}

// ---------------------------------------------------------------------------
// Recurring sanitation plans
// ---------------------------------------------------------------------------

export function normalizeRecurring(raw: RawRecurring, relations: Relations = {}): RecurringIgienizare {
  return {
    id: num(raw.id),
    client: normalizeClient(raw.client ?? {}),
    subscription: raw.subscription ? normalizeSubscription(raw.subscription) : null,
    frequencyDays: num(raw.frequencyDays, 30),
    startDate: optStr(raw.startDate),
    endDate: optStr(raw.endDate),
    isIndefinite: raw.isIndefinite ?? false,
    sanitationLocationAddress: optStr(raw.sanitationLocationAddress),
    sanitationLocationCoordinates: optStr(raw.sanitationLocationCoordinates),
    contact: optStr(raw.contact),
    details: optStr(raw.details),
    route: raw.route ? shallowRoute(normalizeRoute(raw.route, relations)) : null,
    active: raw.active ?? true,
    lastGeneratedDate: optStr(raw.lastGeneratedDate),
  };
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * GET /tasks/{id}/photos returns `List<String>` — bare URLs, no ids. Synthesise
 * stable-per-response ids from the position so the UI has React keys.
 */
export function normalizePhotoUrls(urls: unknown): TaskPhoto[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((entry, index): TaskPhoto | null => {
      if (typeof entry === 'string') return { id: index + 1, url: entry };
      if (entry && typeof entry === 'object') {
        const record = entry as { id?: number; url?: string; imageUrl?: string };
        const url = record.url ?? record.imageUrl;
        if (typeof url === 'string') return { id: num(record.id, index + 1), url };
      }
      return null;
    })
    .filter((photo): photo is TaskPhoto => photo !== null);
}

/**
 * PhotosController returns a human-readable sentence, not JSON:
 *   "Upload successful! Photo saved to client profile. URL: https://…"
 * Pull the URL back out; fall back to the whole message if there is none.
 */
export function extractUrl(message: string): string {
  const match = /https?:\/\/\S+/.exec(message);
  return match ? match[0] : message;
}
