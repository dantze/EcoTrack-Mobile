/**
 * Domain model — mirrors the Spring backend at com.example.damiProd.domain.
 *
 * THIS FILE IS THE SHARED CONTRACT. Every feature module codes against it.
 * Do not redefine these shapes locally. If the backend changes, change it here.
 *
 * Two polymorphic hierarchies use Jackson discriminators, so the wire format
 * carries a literal tag field:
 *   Client -> `type`      : "individual" | "company"
 *   Order  -> `orderType` : "Amplasari" | "Ridicari" | "Igienizari"
 */

// ---------------------------------------------------------------------------
// Enums (string unions — the backend serialises Java enums by name)
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TYPES = ['PLACEMENT', 'PICKUP', 'SANITIZATION'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const SUBSCRIPTION_TYPES = ['ONE_TIME', 'RECURRING'] as const;
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

/**
 * Role names as stored in EmployeeRole.roleName.
 *
 * ADMIN is the one the backend treats as a superset: it satisfies every
 * business-write rule in SecurityConfig's matrix AND is the only role allowed
 * near /api/admin/**. `hasRole` mirrors that, so an admin sees every section
 * rather than only the Admin one.
 */
export const ROLES = ['SALES', 'DRIVER', 'TECH', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

interface ClientBase {
  id: number;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface Individual extends ClientBase {
  type: 'individual';
  fullName: string;
  /** Romanian personal numeric code. */
  CNP: string | null;
  /** Public URL in DigitalOcean Spaces; null when no ID photo uploaded. */
  idPhotoUrl: string | null;
}

export interface Company extends ClientBase {
  type: 'company';
  name: string;
  /** Romanian company registration code. */
  CUI: string | null;
  adminName: string | null;
}

export type Client = Individual | Company;

/** Display name for either client kind. Use this instead of branching inline. */
export function clientName(client: Client): string {
  return client.type === 'company' ? client.name : client.fullName;
}

// ---------------------------------------------------------------------------
// Products & subscriptions
// ---------------------------------------------------------------------------

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
}

export interface Subscription {
  id: number;
  name: string;
  description: string | null;
  type: SubscriptionType;
  price: number | null;
  visitsPerMonth: number | null;
  durationMonths: number | null;
  isIndefinite: boolean | null;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

interface OrderBase {
  id: number;
  /** Human-facing order number, distinct from the surrogate id. */
  number: number;
  /** ISO-8601 instant. */
  date: string;
  client: Client;
  /** Contact person on site. */
  contact: string | null;
  /** Optional free-text notes. */
  details: string | null;
}

/** Placement of cabins at a site. */
export interface AmplasareOrder extends OrderBase {
  orderType: 'Amplasari';
  product: Product | null;
  quantity: number | null;
  isIndefinite: boolean | null;
  durationDays: number | null;
  /** ISO date, "YYYY-MM-DD". */
  startDate: string | null;
  endDate: string | null;
  /** "lat,long" — parse with parseCoordinates(). */
  locationCoordinates: string | null;
  locationAddress: string | null;
  igienizariPerMonth: number | null;
}

/** Pickup / removal of previously placed cabins. */
export interface RidicareOrder extends OrderBase {
  orderType: 'Ridicari';
  product: Product | null;
  pickupDate: string | null;
  pickupQuantity: number | null;
  /** Denormalised product name kept for quick display. */
  pickupProductName: string | null;
  pickupLocationAddress: string | null;
  pickupLocationCoordinates: string | null;
}

/** Sanitation visit, one-off or generated from a recurring plan. */
export interface IgienizareOrder extends OrderBase {
  orderType: 'Igienizari';
  subscription: Subscription | null;
  sanitationDate: string | null;
  sanitationLocationAddress: string | null;
  sanitationLocationCoordinates: string | null;
  recurringPlan: RecurringIgienizare | null;
}

export type Order = AmplasareOrder | RidicareOrder | IgienizareOrder;

export const ORDER_TYPES = ['Amplasari', 'Ridicari', 'Igienizari'] as const;
export type OrderTypeTag = (typeof ORDER_TYPES)[number];

// ---------------------------------------------------------------------------
// Employees, routes, tasks
// ---------------------------------------------------------------------------

/** Shape returned by /api/employees and /api/admin/employees (EmployeeResponse). */
export interface Employee {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  county: string | null;
  roles: Role[];
}

export interface Route {
  id: number;
  name: string;
  /** ISO date, "YYYY-MM-DD". */
  date: string | null;
  /** 1 = Monday … 7 = Sunday, per java.time.DayOfWeek. */
  dayOfWeek: number | null;
  county: string | null;
  employee: Employee | null;
  tasks: Task[];
}

export interface TaskPhoto {
  id: number;
  url: string;
}

export interface Task {
  id: number;
  type: TaskType;
  /** ISO-8601 local date-time. */
  scheduledTime: string | null;
  /** ISO date, "YYYY-MM-DD". */
  scheduledDate: string | null;
  status: TaskStatus;
  address: string | null;
  /** "lat,lng" — parse with parseCoordinates(). */
  coordinates: string | null;
  clientName: string | null;
  clientPhone: string | null;
  contactPerson: string | null;
  productName: string | null;
  quantity: number | null;
  internalNotes: string | null;
  /** Position within the route; drives drag-to-reorder. */
  orderIndex: number;
  route: Route | null;
  order: Order | null;
  photos: TaskPhoto[];
  recurringPlan: RecurringIgienizare | null;
}

export interface RecurringIgienizare {
  id: number;
  client: Client;
  subscription: Subscription | null;
  frequencyDays: number;
  startDate: string | null;
  endDate: string | null;
  isIndefinite: boolean;
  sanitationLocationAddress: string | null;
  sanitationLocationCoordinates: string | null;
  contact: string | null;
  details: string | null;
  route: Route | null;
  active: boolean;
  lastGeneratedDate: string | null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  county: string | null;
  /** Used to match a Google account to an employee record on /auth/google. */
  email: string | null;
  roles: Role[];
}

// ---------------------------------------------------------------------------
// Coordinate helpers — the backend stores coordinates as "lat,lng" strings
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export function parseCoordinates(raw: string | null | undefined): LatLng | null {
  if (!raw) return null;
  const [lat, lng] = raw.split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function formatCoordinates(point: LatLng): string {
  return `${point.lat},${point.lng}`;
}
