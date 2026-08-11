/**
 * The API contract.
 *
 * Both implementations — `src/api/live/` (real backend) and `src/mocks/`
 * (seeded in-memory dataset) — must satisfy `EcoTrackApi` exactly. Feature
 * code imports the resolved `api` object from `@/api` and never touches
 * fetch or the mock store directly.
 *
 * Endpoint paths in the doc comments are relative to /api and correspond
 * 1:1 to the Spring controllers. Request shapes below were read off the
 * controllers, not inferred — several are non-obvious:
 *   - reorderTasks sends a BARE JSON ARRAY of ids, not a wrapper object
 *   - orderHasTask returns an object, not a boolean
 *   - task photo upload uses the multipart field name "files"
 */

import type {
  AuthUser,
  Client,
  Employee,
  LoginResponse,
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
// Request payloads
// ---------------------------------------------------------------------------

/** Fields settable when creating/updating a client, minus the server-owned id. */
export type ClientInput =
  | { type: 'individual'; fullName: string; CNP?: string | null; email?: string | null; phone?: string | null; address?: string | null }
  | { type: 'company'; name: string; CUI?: string | null; adminName?: string | null; email?: string | null; phone?: string | null; address?: string | null };

/** Order creation payload. `orderType` selects the subtype-specific fields. */
export type OrderInput = { orderType: OrderTypeTag } & Record<string, unknown>;

export interface CreateRouteInput {
  name: string;
  /** ISO date "YYYY-MM-DD". */
  date?: string | null;
  /** 1 = Monday … 7 = Sunday. */
  dayOfWeek?: number | null;
  county?: string | null;
  employeeId?: number | null;
}

export interface CreateTaskInput {
  type: TaskType;
  scheduledTime?: string | null;
  address?: string | null;
  coordinates?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  contactPerson?: string | null;
  productName?: string | null;
  quantity?: number | null;
  internalNotes?: string | null;
  routeId?: number | null;
  orderId?: number | null;
}

export interface CreateEmployeeInput {
  username: string;
  password: string;
  fullName: string;
  phone?: string | null;
  county?: string | null;
  roles: Role[];
}

/** Response of GET /tasks/order/{orderId}/exists — note: not a boolean. */
export interface OrderTaskStatus {
  hasTask: boolean;
  taskId: number | null;
  routeId: number | null;
  scheduledTime: string | null;
  status: TaskStatus | null;
}

// ---------------------------------------------------------------------------
// Per-resource interfaces
// ---------------------------------------------------------------------------

export interface AuthApi {
  /** POST /auth/login */
  login(username: string, password: string): Promise<LoginResponse>;
  /** Reads the persisted session from localStorage. No network call. */
  currentUser(): AuthUser | null;
  /** Clears the persisted session. No network call. */
  logout(): void;
}

export interface ClientsApi {
  /** GET /clients */
  list(): Promise<Client[]>;
  /** GET /clients/{id} */
  get(id: number): Promise<Client>;
  /** POST /clients */
  create(input: ClientInput): Promise<Client>;
  /** PUT /clients/{id} */
  update(id: number, input: ClientInput): Promise<Client>;
  /** DELETE /clients/{id} */
  remove(id: number): Promise<void>;
  /** GET /clients/{id}/has-orders — guards deletion in the UI. */
  hasOrders(id: number): Promise<boolean>;
  /** POST /{clientId}/idPhoto (multipart, field "file"). Returns the public URL. */
  uploadIdPhoto(clientId: number, file: File): Promise<string>;
  /** DELETE /{clientId}/idPhoto */
  deleteIdPhoto(clientId: number): Promise<string>;
}

export interface OrdersApi {
  /** GET /orders */
  list(): Promise<Order[]>;
  /** GET /orders/{orderId} */
  get(orderId: number): Promise<Order>;
  /** GET /clients/{clientId}/orders */
  listForClient(clientId: number): Promise<Order[]>;
  /** POST /clients/{clientId}/orders */
  create(clientId: number, input: OrderInput): Promise<Order>;
  /** PUT /orders/{orderId} */
  update(orderId: number, input: OrderInput): Promise<Order>;
  /** DELETE /orders/{orderId} */
  remove(orderId: number): Promise<void>;
}

export interface ProductsApi {
  /** GET /products */
  list(): Promise<Product[]>;
  /** POST /products */
  create(input: Omit<Product, 'id'>): Promise<Product>;
  /** PUT /products/{id} */
  update(id: number, input: Omit<Product, 'id'>): Promise<Product>;
  /** DELETE /products/{id} */
  remove(id: number): Promise<void>;
}

export interface SubscriptionsApi {
  /** GET /subscriptions — active only. */
  list(): Promise<Subscription[]>;
  /** GET /subscriptions/all — includes inactive. */
  listAll(): Promise<Subscription[]>;
  /** GET /subscriptions/{id} */
  get(id: number): Promise<Subscription>;
  /** POST /subscriptions */
  create(input: Omit<Subscription, 'id'>): Promise<Subscription>;
  /** PUT /subscriptions/{id} */
  update(id: number, input: Omit<Subscription, 'id'>): Promise<Subscription>;
  /** DELETE /subscriptions/{id} */
  remove(id: number): Promise<void>;
}

export interface EmployeesApi {
  /** GET /employees */
  list(): Promise<Employee[]>;
  /** GET /employees/{id} */
  get(id: number): Promise<Employee>;
  /** GET /employees/drivers */
  listDrivers(): Promise<Employee[]>;
  /** GET /employees/role/{roleName} */
  listByRole(role: Role): Promise<Employee[]>;
  /** POST /admin/employees — requires X-Admin-Key. */
  create(input: CreateEmployeeInput): Promise<Employee>;
  /** PUT /admin/employees/{id} — requires X-Admin-Key. */
  update(id: number, input: Partial<CreateEmployeeInput>): Promise<Employee>;
  /** DELETE /admin/employees/{id} — requires X-Admin-Key. */
  remove(id: number): Promise<void>;
}

export interface RoutesApi {
  /** GET /routes */
  list(): Promise<Route[]>;
  /** GET /routes/{id} */
  get(id: number): Promise<Route>;
  /** GET /routes/employee/{employeeId} */
  listForEmployee(employeeId: number): Promise<Route[]>;
  /** GET /routes/employee/{employeeId}/date/{date} — date is "YYYY-MM-DD". */
  listForEmployeeOnDate(employeeId: number, date: string): Promise<Route[]>;
  /** POST /routes */
  create(input: CreateRouteInput): Promise<Route>;
  /** DELETE /routes/{id} */
  remove(id: number): Promise<void>;
  /** PUT /routes/{routeId}/assign-driver/{employeeId} */
  assignDriver(routeId: number, employeeId: number): Promise<Route>;
  /**
   * PUT /routes/{routeId}/reorder-tasks
   * Body is a bare JSON array of task ids in their new order.
   */
  reorderTasks(routeId: number, taskIds: number[]): Promise<Route>;
}

export interface TasksApi {
  /** GET /tasks */
  list(): Promise<Task[]>;
  /** GET /tasks/{id} */
  get(id: number): Promise<Task>;
  /** GET /tasks/route/{routeId} */
  listForRoute(routeId: number): Promise<Task[]>;
  /** GET /tasks/route/{routeId}/date/{date} */
  listForRouteOnDate(routeId: number, date: string): Promise<Task[]>;
  /** GET /tasks/employee/{employeeId} */
  listForEmployee(employeeId: number): Promise<Task[]>;
  /** GET /tasks/employee/{employeeId}/date/{date} */
  listForEmployeeOnDate(employeeId: number, date: string): Promise<Task[]>;
  /** POST /tasks */
  create(input: CreateTaskInput): Promise<Task>;
  /** POST /tasks/from-order */
  createFromOrder(orderId: number, routeId?: number | null): Promise<Task>;
  /** GET /tasks/order/{orderId}/exists */
  statusForOrder(orderId: number): Promise<OrderTaskStatus>;
  /** PATCH /tasks/{id}/status — body { status }. */
  updateStatus(id: number, status: TaskStatus): Promise<Task>;
  /**
   * PATCH /tasks/{id}/scheduled-date — body { scheduledDate: "YYYY-MM-DD" }.
   * The backend pins the time to 08:00 on that date.
   */
  updateScheduledDate(id: number, date: string): Promise<Task>;
  /** DELETE /tasks/{id} */
  remove(id: number): Promise<void>;
  /** PUT /tasks/{id}/reassign/{newRouteId} */
  reassign(taskId: number, newRouteId: number): Promise<Task>;
  /** PUT /tasks/reassign — body { taskIds, newRouteId }. Powers bulk-select. */
  reassignMany(taskIds: number[], newRouteId: number): Promise<Task[]>;
  /** GET /tasks/{id}/photos */
  listPhotos(taskId: number): Promise<TaskPhoto[]>;
  /** POST /tasks/{id}/photos (multipart, repeated field "files"). */
  uploadPhotos(taskId: number, files: File[]): Promise<TaskPhoto[]>;
}

export interface RecurringApi {
  /** GET /recurring-igienizari */
  list(): Promise<RecurringIgienizare[]>;
  /** GET /recurring-igienizari/active */
  listActive(): Promise<RecurringIgienizare[]>;
  /** GET /recurring-igienizari/unassigned — plans with no route yet. */
  listUnassigned(): Promise<RecurringIgienizare[]>;
  /** GET /recurring-igienizari/{id} */
  get(id: number): Promise<RecurringIgienizare>;
  /** GET /recurring-igienizari/client/{clientId} */
  listForClient(clientId: number): Promise<RecurringIgienizare[]>;
  /** POST /recurring-igienizari/client/{clientId} */
  create(clientId: number, input: Partial<RecurringIgienizare>): Promise<RecurringIgienizare>;
  /** PUT /recurring-igienizari/{id}/assign-route — body { routeId }. */
  assignRoute(id: number, routeId: number): Promise<RecurringIgienizare>;
  /** PUT /recurring-igienizari/{id}/deactivate */
  deactivate(id: number): Promise<RecurringIgienizare>;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface EcoTrackApi {
  auth: AuthApi;
  clients: ClientsApi;
  orders: OrdersApi;
  products: ProductsApi;
  subscriptions: SubscriptionsApi;
  employees: EmployeesApi;
  routes: RoutesApi;
  tasks: TasksApi;
  recurring: RecurringApi;
}
