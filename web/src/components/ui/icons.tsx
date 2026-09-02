/**
 * The kit's icon set — thin aliases over `lucide-react`.
 *
 * The hand-rolled 16px strokes that used to live here are gone: lucide is
 * already a dependency (every shadcn primitive draws from it), so a second,
 * smaller, inconsistent set was pure drift. The named `*Icon` exports survive
 * because ~30 screens import them; **new code should import from
 * `lucide-react` directly** and pick whichever glyph fits.
 *
 * The aliases exist to keep two things the old set gave call sites for free:
 * a default `size-4 shrink-0` (lucide defaults to 24px, which is a third
 * bigger than a dense toolbar row), and `title` turning a decorative glyph
 * into a labelled one.
 */

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Info,
  MapPin,
  Pencil,
  Search,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconProps = {
  className?: string;
  /** Icons are decorative unless a caller gives them a label. */
  title?: string;
};

/**
 * Lucide renders `aria-hidden` by default; a `title` flips it to an image with
 * an accessible name, which is what the old `Svg` wrapper did.
 */
function alias(Glyph: LucideIcon) {
  return function Icon({ className, title }: IconProps) {
    return (
      <Glyph
        className={cn('shrink-0', className ?? 'size-4')}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
        aria-label={title}
      />
    );
  };
}

export const ChevronDownIcon = alias(ChevronDown);
export const ChevronUpIcon = alias(ChevronUp);
export const CheckIcon = alias(Check);
export const CloseIcon = alias(X);
export const SearchIcon = alias(Search);
export const PinIcon = alias(MapPin);
export const PencilIcon = alias(Pencil);
export const AlertIcon = alias(TriangleAlert);
export const InfoIcon = alias(Info);

/** Sort affordance: both chevrons when idle, one arrow when the column is sorted. */
export function SortIcon({ direction }: { direction?: 'asc' | 'desc' }) {
  if (!direction) {
    return (
      <ChevronsUpDown
        aria-hidden
        className="size-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover/th:opacity-100"
      />
    );
  }
  const Arrow = direction === 'asc' ? ArrowUp : ArrowDown;
  return <Arrow aria-hidden className="size-3 shrink-0 text-accent-500" />;
}

/**
 * The underlying glyphs, for kit components that want the lucide names. Feature
 * code should reach for `lucide-react` itself rather than widening this list.
 */
export {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Info,
  MapPin,
  Pencil,
  Search,
  TriangleAlert,
  X,
};
