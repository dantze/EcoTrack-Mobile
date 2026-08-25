/**
 * UI kit barrel — feature code imports everything from '@/components/ui'.
 *
 * The prop contract lives in ./types.ts and is frozen; implementations live one
 * file per component alongside it. Components accept the contract props plus a
 * few optional extras declared next to each implementation (`*ExtraProps`),
 * which are re-exported here.
 *
 *   Layout     PageHeader · Tabs · FilterBar · SearchInput · EmptyState
 *   Data       DataTable · EditableCell · Badge · DetailList
 *   Assistive  SuggestionCard · WarningNote (accept/ignore, never auto-apply)
 *   Forms      TextInput · TextArea · Select · Autocomplete · DateInput · Checkbox · FieldRow
 *   Overlays   Modal · Drawer · useConfirm · ToastProvider / useToast
 *   Primitives Button · IconButton · Spinner · Skeleton
 */

export * from './types';

export { Button, IconButton, Spinner, Skeleton } from './Button';
export type { ButtonExtraProps } from './Button';

export { FieldShell, FieldRow, describedBy } from './Field';
export type { FieldShellProps } from './Field';

export { TextInput } from './TextInput';
export type { TextInputExtraProps } from './TextInput';
export { TextArea } from './TextArea';
export { Select } from './Select';
export type { SelectExtraProps } from './Select';
export { Autocomplete } from './Autocomplete';
export type { AutocompleteOption, AutocompleteProps } from './Autocomplete';
export { DateInput } from './DateInput';
export type { DateInputExtraProps } from './DateInput';
export { Checkbox } from './Checkbox';
export type { CheckboxExtraProps } from './Checkbox';

export { SuggestionCard, WarningNote } from './SuggestionCard';

export { Badge } from './Badge';
export type { BadgeExtraProps } from './Badge';
export { PageHeader } from './PageHeader';
export type { PageHeaderExtraProps } from './PageHeader';
export { EmptyState } from './EmptyState';
export type { EmptyStateExtraProps } from './EmptyState';
export { Tabs } from './Tabs';
export type { TabsExtraProps } from './Tabs';

export { Modal, Drawer, DetailList } from './Overlay';
export type { OverlayExtraProps } from './Overlay';

export {
  ToastProvider,
  ToastViewport,
  ConfirmHost,
  FeedbackHost,
  useToast,
  useConfirm,
  toast,
  dismissToast,
  requestConfirm,
} from './feedback';

export { DataTable } from './DataTable';
export type { DataTableColumn, DataTableExtendedProps, SortState } from './DataTable';

export { EditableCell } from './EditableCell';
export type { EditableCellProps } from './EditableCell';

export { FilterBar, SearchInput } from './FilterBar';
export type { FilterBarProps, FilterChip, SearchInputProps } from './FilterBar';

export {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  InfoIcon,
  PencilIcon,
  SearchIcon,
  SortIcon,
} from './icons';

export { cx } from './utils';
