/**
 * The reading pane.
 *
 * Outlook's central idea: the list stays on screen while you read one record.
 * Opening a record must not cost the operator their place in the list, and
 * closing it must not cost a round trip.
 *
 * Two presentations of the same content, chosen by viewport width:
 *
 *   ≥ lg   a resizable horizontal split. The width is remembered per screen
 *          (`storageKey`), because how much of the list a dispatcher wants to
 *          see is a personal, sticky preference.
 *   < lg   a full-height Sheet over the list. Squeezing two panes into 380 px
 *          gives two unusable columns instead of one good one.
 *
 * The breakpoint is read with a media query rather than a container query on
 * purpose: what matters is whether the DEVICE has room for two columns.
 */

import { useEffect, type ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { cn } from '@/lib/utils';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/resizable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/shadcn/sheet';
import { usePersistentState } from './Workbench';

export interface ListDetailProps {
  list: ReactNode;
  /** Rendered in the pane / sheet. Falsy means "nothing selected". */
  detail?: ReactNode;
  /** Whether a record is open. Kept separate from `detail` so a screen can
   *  render a loading pane for a selection whose data has not arrived. */
  selected?: boolean;
  onCloseDetail?: () => void;
  /** Sheet title on mobile; also the pane's accessible name. */
  detailTitle?: ReactNode;
  /** Screen-reader description of the pane, when the title alone is thin. */
  detailDescription?: string;
  /** Distinct key per screen so each remembers its own split. */
  storageKey?: string;
  /** Percentage of the width the list gets by default. */
  defaultListSize?: number;
  className?: string;
}

const LG = '(min-width: 1024px)';

export function ListDetail({
  list,
  detail,
  selected = false,
  onCloseDetail,
  detailTitle = 'Detalii',
  detailDescription,
  storageKey = 'ecotrack.pane.default',
  defaultListSize = 58,
  className,
}: ListDetailProps) {
  // `undefined` on the very first render (and always, in jsdom). Treated as
  // desktop: a phone briefly showing the split is a worse first frame than a
  // wide screen briefly showing one column, and tests then exercise the pane.
  const isWide = useMediaQuery(LG, true, { getInitialValueInEffect: false });

  const [listSize, setListSize] = usePersistentState<number>(
    `${storageKey}.list`,
    defaultListSize,
  );

  // Escape closes the pane, matching the Sheet's own behaviour, so the gesture
  // is the same at every width.
  useEffect(() => {
    if (!isWide || !selected || !onCloseDetail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onCloseDetail();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isWide, selected, onCloseDetail]);

  if (!isWide) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
        {list}
        <Sheet
          open={selected}
          onOpenChange={(open) => {
            if (!open) onCloseDetail?.();
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
            aria-describedby={detailDescription ? undefined : undefined}
          >
            <SheetHeader className="border-b border-border px-3 py-2.5">
              <SheetTitle className="pr-8 text-sm">{detailTitle}</SheetTitle>
              {detailDescription ? (
                <SheetDescription className="text-xs">{detailDescription}</SheetDescription>
              ) : null}
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">{detail}</div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  if (!selected) {
    return <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{list}</div>;
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className={cn('min-h-0 flex-1', className)}
      defaultLayout={{ list: listSize, detail: 100 - listSize }}
      onLayoutChanged={(layout, meta) => {
        // Only a deliberate drag is worth persisting; mount and imperative
        // resizes would otherwise overwrite the remembered width with the
        // default on every visit.
        if (meta.isUserInteraction && typeof layout.list === 'number') {
          setListSize(Math.round(layout.list));
        }
      }}
    >
      <ResizablePanel id="list" minSize={28} className="flex min-w-0 flex-col">
        {list}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="bg-border transition-colors hover:bg-accent-400 data-[dragging]:bg-accent-500"
      />
      <ResizablePanel
        id="detail"
        minSize={24}
        className="flex min-w-0 flex-col bg-surface shadow-panel"
      >
        <section aria-label={typeof detailTitle === 'string' ? detailTitle : 'Detalii'} className="flex min-h-0 flex-1 flex-col">
          {detail}
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
