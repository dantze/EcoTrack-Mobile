/**
 * UI kit prop contract.
 *
 * FROZEN INTERFACE. Feature screens code against these signatures; the UI
 * agent owns the implementations behind them. Adding optional props is fine;
 * renaming or removing existing ones breaks the feature modules.
 */

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// DataTable — the centrepiece of the desktop layout
// ---------------------------------------------------------------------------

export interface Column<T> {
  /** Stable identifier, also used as the sort key. */
  key: string;
  header: string;
  /** Cell contents. Omit for a plain string cell. */
  render?: (row: T) => ReactNode;
  /** Return a comparable primitive to make the column sortable. */
  sortValue?: (row: T) => string | number | null;
  /** CSS width, e.g. "8rem" or "1fr". */
  width?: string;
  align?: 'left' | 'right' | 'center';
}

export type RowKey = string | number;

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => RowKey;
  loading?: boolean;
  /** Shown when `rows` is empty and not loading. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Highlights the active row, e.g. the one open in a side panel. */
  activeKey?: RowKey | null;
  /** Presence of both enables the checkbox column and bulk actions. */
  selectedKeys?: Set<RowKey>;
  onSelectionChange?: (keys: Set<RowKey>) => void;
  /** Rendered above the table when a selection exists. */
  bulkActions?: ReactNode;
  density?: 'compact' | 'comfortable';
  stickyHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export interface FieldProps {
  label?: string;
  /** Validation message; renders the control in an error state. */
  error?: string;
  hint?: string;
  required?: boolean;
}

export type TextInputProps = FieldProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>;

export type TextAreaProps = FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export interface SelectOption<V = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<V = string> extends FieldProps {
  value: V | null;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Adds a text filter above the options. */
  searchable?: boolean;
}

export type DateInputProps = FieldProps & {
  /** ISO date, "YYYY-MM-DD". */
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
};

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  indeterminate?: boolean;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Overlays & feedback
// ---------------------------------------------------------------------------

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Right-aligned action row pinned to the bottom. */
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

/** Slide-over panel used for record detail without leaving the table. */
export interface DrawerProps extends Omit<ModalProps, 'width'> {
  width?: 'md' | 'lg' | 'xl';
}

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface PageHeaderProps {
  title: ReactNode;
  /** Count, filter summary, or similar context under the title. */
  subtitle?: ReactNode;
  /** Right-aligned primary actions. */
  actions?: ReactNode;
}

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
}
