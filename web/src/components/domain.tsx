/**
 * Domain-aware display helpers shared by the Sales and Technical modules.
 *
 * Romanian labels for backend enums live here and nowhere else — if both
 * feature agents translated `TaskStatus` independently they would drift.
 */

import { Badge } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import type { OrderTypeTag, Role, TaskStatus, TaskType } from '@/types/domain';
import { type Client, clientName } from '@/types/domain';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: 'Nou',
  IN_PROGRESS: 'În curs',
  COMPLETED: 'Finalizat',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  PLACEMENT: 'Amplasare',
  PICKUP: 'Ridicare',
  SANITIZATION: 'Igienizare',
};

export const ORDER_TYPE_LABELS: Record<OrderTypeTag, string> = {
  Amplasari: 'Amplasare',
  Ridicari: 'Ridicare',
  Igienizari: 'Igienizare',
};

/** For counted lists — "2 Amplasări" reads wrong with the singular label. */
export const ORDER_TYPE_PLURAL_LABELS: Record<OrderTypeTag, string> = {
  Amplasari: 'Amplasări',
  Ridicari: 'Ridicări',
  Igienizari: 'Igienizări',
};

/** "1 Amplasare" / "3 Amplasări" — Romanian agrees at 1, like English. */
export function orderTypeCountLabel(type: OrderTypeTag, count: number): string {
  return count === 1 ? ORDER_TYPE_LABELS[type] : ORDER_TYPE_PLURAL_LABELS[type];
}

/**
 * "1 comandă" · "3 comenzi" · "24 de comenzi".
 *
 * Romanian inserts "de" before the noun once the last two digits are 00 or
 * 20–99, which is the bit an English-speaking pluraliser gets wrong.
 */
export function orderCountLabel(count: number): string {
  if (count === 1) return '1 comandă';
  const lastTwo = Math.abs(count) % 100;
  const needsDe = count !== 0 && (lastTwo === 0 || lastTwo >= 20);
  return `${count} ${needsDe ? 'de ' : ''}comenzi`;
}

export const ROLE_LABELS: Record<Role, string> = {
  SALES: 'Vânzări',
  DRIVER: 'Șofer',
  TECH: 'Tehnic',
  ADMIN: 'Administrator',
};

export const WEEKDAY_LABELS = [
  'Luni',
  'Marți',
  'Miercuri',
  'Joi',
  'Vineri',
  'Sâmbătă',
  'Duminică',
];

/** dayOfWeek is 1 = Monday … 7 = Sunday, per java.time.DayOfWeek. */
export function weekdayLabel(dayOfWeek: number | null): string {
  if (dayOfWeek === null || dayOfWeek < 1 || dayOfWeek > 7) return '—';
  return WEEKDAY_LABELS[dayOfWeek - 1];
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone = status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{TASK_STATUS_LABELS[status]}</Badge>;
}

/**
 * One tone per kind of work, whichever name it goes by.
 *
 * An order type and a task type are the same three things — `mapOrderTypeToTaskType`
 * on the backend is the identity — so they must be the same colour. They were
 * not: Comenzi drew Amplasare blue while the dispatch board drew it green, and
 * Ridicare was quiet grey on one screen and amber on the other, which is the
 * colour this app uses for "in progress" and "fără șofer". A dispatcher moving
 * between the two screens was reading two different legends.
 *
 * Keyed off one object so the next person cannot half-change it.
 */
const WORK_TONES = {
  placement: 'info',
  pickup: 'neutral',
  sanitation: 'success',
} as const;

export const ORDER_TYPE_TONES: Record<OrderTypeTag, BadgeProps['tone']> = {
  Amplasari: WORK_TONES.placement,
  Ridicari: WORK_TONES.pickup,
  Igienizari: WORK_TONES.sanitation,
};

export const TASK_TYPE_TONES: Record<TaskType, BadgeProps['tone']> = {
  PLACEMENT: WORK_TONES.placement,
  PICKUP: WORK_TONES.pickup,
  SANITIZATION: WORK_TONES.sanitation,
};

export function OrderTypeBadge({ type }: { type: OrderTypeTag }) {
  return <Badge tone={ORDER_TYPE_TONES[type]}>{ORDER_TYPE_LABELS[type]}</Badge>;
}

/** Client name plus a quiet marker for company vs individual. */
export function ClientCell({ client }: { client: Client }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{clientName(client)}</span>
      <span className="shrink-0 text-xs text-ink-subtle">
        {client.type === 'company' ? 'PJ' : 'PF'}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('ro-RO', {
  style: 'currency',
  currency: 'RON',
  maximumFractionDigits: 2,
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed);
}

const dateTimeFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Date AND time. Sessions are the only thing that needs the clock: "activ
 * ultima dată 14:32" is how the right device gets picked out of ten, in both
 * the account menu and the admin view of somebody else's devices (TODO-56).
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
}

export function formatMoney(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? '—' : currencyFormatter.format(amount);
}
