/**
 * Domain-aware display helpers shared by the Sales and Technical modules.
 *
 * Romanian labels for backend enums live here and nowhere else — if both
 * feature agents translated `TaskStatus` independently they would drift.
 */

import { Badge } from '@/components/ui';
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

export function OrderTypeBadge({ type }: { type: OrderTypeTag }) {
  const tone = type === 'Amplasari' ? 'info' : type === 'Ridicari' ? 'neutral' : 'success';
  return <Badge tone={tone}>{ORDER_TYPE_LABELS[type]}</Badge>;
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

export function formatMoney(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? '—' : currencyFormatter.format(amount);
}
