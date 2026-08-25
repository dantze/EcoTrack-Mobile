/**
 * The kit's icon set — hand-rolled 16px strokes.
 *
 * No icon package by design: we need eight glyphs, and a dependency for that
 * would outweigh the code below. All of them inherit `currentColor` and size
 * from the `size-*` class on the wrapper, so they tint with their button.
 */

type IconProps = {
  className?: string;
  /** Icons are decorative unless a caller gives them a label. */
  title?: string;
};

function Svg({ className, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={className ?? 'size-4 shrink-0'}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const ChevronDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 6.5 8 10.5l4-4" />
  </Svg>
);

export const ChevronUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 9.5 8 5.5l4 4" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m3.5 8.5 3 3 6-7" />
  </Svg>
);

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="7.2" cy="7.2" r="4.2" />
    <path d="m10.4 10.4 2.6 2.6" />
  </Svg>
);

export const PencilIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M11.2 2.8a1.4 1.4 0 0 1 2 2L6 12l-2.8.8L4 10z" />
  </Svg>
);

export const AlertIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 2.8 14.2 13H1.8z" />
    <path d="M8 6.6v2.8M8 11.4h.01" />
  </Svg>
);

export const InfoIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.4v3.4M8 5.2h.01" />
  </Svg>
);

/** Sort affordance: both chevrons when idle, one solid when active. */
export function SortIcon({ direction }: { direction?: 'asc' | 'desc' }) {
  if (!direction) {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="size-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover/th:opacity-100"
        fill="currentColor"
      >
        <path d="M8 2.5 11 6H5zM8 13.5 5 10h6z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-3 shrink-0 text-brand-600" fill="currentColor">
      {direction === 'asc' ? <path d="M8 3.5 12 9H4z" /> : <path d="M8 12.5 4 7h8z" />}
    </svg>
  );
}
