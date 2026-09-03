/**
 * Calendar — Comenzi seen as a month instead of a list.
 *
 * The table answers "which orders match this filter"; the calendar answers
 * "how loaded is next Tuesday", which no amount of sorting a list gives you.
 * Same data, same date definition (`orderPrimaryDate`), same records — one
 * screen sideways from the other in the Vânzări section.
 *
 * A tile shows the day's summary under its date and opens the day's orders when
 * clicked; picking one from there hands off to Comenzi via `?comanda=<id>`, so
 * this screen never becomes a second place to edit an order.
 *
 * `?zi=YYYY-MM-DD` opens a day directly, which also makes a day shareable —
 * the same trick `?comanda=` plays for a single order.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, RefreshCw } from 'lucide-react';
import {
  CommandBar,
  ListDetail,
  ToolbarSeparator,
  Workbench,
  usePersistentState,
} from '@/components/layout';
import { Button, Select, Skeleton, type SelectOption } from '@/components/ui';
import { ORDER_TYPE_LABELS, orderCountLabel } from '@/components/domain';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import { useDeepLink, useDeepLinkOnce } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { ErrorNotice } from './components/FilterBar';
import { DayOrdersPane } from './components/DayOrdersDrawer';
import { MonthAgenda } from './components/MonthAgenda';
import { MonthGrid } from './components/MonthGrid';
import {
  buildMonthGrid,
  groupOrdersByDay,
  monthLabel,
  monthStartIso,
  monthTotal,
  shiftMonth,
} from './calendar';
import { useOrders } from './queries';

/** '' is "no filter" — the same convention the Comenzi filter strip uses. */
type TypeFilter = '' | OrderTypeTag;

const TYPE_OPTIONS: SelectOption<TypeFilter>[] = [
  { value: '', label: 'Toate tipurile' },
  ...ORDER_TYPES.map((type) => ({ value: type, label: ORDER_TYPE_LABELS[type] })),
];

/** Matches the ISO dates the deep link and the grid speak. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function CalendarPage() {
  const ordersQuery = useOrders();
  const navigate = useNavigate();

  const [monthIso, setMonthIso] = useState(() => monthStartIso());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const buckets = useMemo(
    () => groupOrdersByDay(typeFilter ? orders.filter((o) => o.orderType === typeFilter) : orders),
    [orders, typeFilter],
  );

  // Rebuilt when the month changes; `isToday` is resolved against the real
  // clock at that moment, which is as fresh as a back-office tab needs.
  const cells = useMemo(() => buildMonthGrid(monthIso), [monthIso]);

  const total = useMemo(() => monthTotal(cells, buckets), [cells, buckets]);

  // ── Deep link: /calendar?zi=2026-08-14 opens that day ───────────────────
  const linkedDay = useDeepLink().raw('zi');

  // Validated here, not inside the hook: a `zi` this screen cannot read stays
  // in the URL rather than being silently consumed.
  useDeepLinkOnce('zi', linkedDay !== null && ISO_DATE.test(linkedDay) ? linkedDay : null, (day) => {
    setMonthIso(monthStartIso(new Date(`${day}T00:00:00`)));
    setSelectedIso(day);
  });

  const goToday = () => {
    setMonthIso(monthStartIso());
    setSelectedIso(null);
  };

  const step = (delta: number) => {
    setMonthIso((current) => shiftMonth(current, delta));
    setSelectedIso(null);
  };

  useShortcuts([
    {
      combo: 't',
      description: 'Mergi la luna curentă',
      group: 'Calendar',
      run: goToday,
    },
    {
      combo: 'r',
      description: 'Reîmprospătează comenzile',
      group: 'Calendar',
      run: () => void ordersQuery.refetch(),
    },
  ]);

  const openOrder = (orderId: number) => {
    recordUse('order', orderId);
    navigate(`/comenzi?comanda=${orderId}`);
  };

  const selectedBucket = selectedIso === null ? undefined : buckets.get(selectedIso);

  // A 7-column grid needs ~700px to be readable; below that the same month is
  // better read as an agenda — the days that HAVE work, in order. `undefined`
  // on the first render (and in jsdom) counts as the wide case.
  const isWide = useMediaQuery('(min-width: 768px)', true, { getInitialValueInEffect: false });
  const [preferredView, setPreferredView] = usePersistentState<'grid' | 'agenda'>(
    'ecotrack.calendar.view',
    'grid',
  );
  const view = isWide ? preferredView : 'agenda';

  return (
    <Workbench>
      <CommandBar
        title="Calendar"
        subtitle={
          ordersQuery.isLoading
            ? 'Se încarcă…'
            : `${orderCountLabel(total)} în ${monthLabel(monthIso).toLowerCase()}${
                typeFilter ? ` · doar ${ORDER_TYPE_LABELS[typeFilter]}` : ''
              }`
        }
        tools={
          <>
            <div className="w-36 sm:w-40">
              <Select
                value={typeFilter}
                options={TYPE_OPTIONS}
                onChange={setTypeFilter}
                size="sm"
              />
            </div>
            {isWide && (
              <div className="flex items-center rounded-md border border-border p-0.5">
                <Button
                  variant={view === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={view === 'grid'}
                  icon={<CalendarDays aria-hidden />}
                  onClick={() => setPreferredView('grid')}
                >
                  <span className="hidden lg:inline">Lună</span>
                </Button>
                <Button
                  variant={view === 'agenda' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={view === 'agenda'}
                  icon={<List aria-hidden />}
                  onClick={() => setPreferredView('agenda')}
                >
                  <span className="hidden lg:inline">Agendă</span>
                </Button>
              </div>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => step(-1)}
              aria-label="Luna anterioară"
              icon={<ChevronLeft aria-hidden />}
            />
            <span className="min-w-36 text-center text-sm font-semibold text-ink">
              {monthLabel(monthIso)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => step(1)}
              aria-label="Luna următoare"
              icon={<ChevronRight aria-hidden />}
            />
            <Button variant="secondary" size="sm" onClick={goToday}>
              Azi
            </Button>
            <ToolbarSeparator />
            <Button
              variant="primary"
              size="sm"
              icon={<Plus aria-hidden />}
              onClick={() => navigate('/comenzi?nou=1')}
            >
              Comandă nouă
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw aria-hidden />}
              onClick={() => void ordersQuery.refetch()}
              loading={ordersQuery.isFetching}
            >
              Reîmprospătează
            </Button>
          </>
        }
      />

      <ListDetail
        storageKey="ecotrack.pane.calendar"
        defaultListSize={64}
        selected={selectedIso !== null && selectedBucket !== undefined}
        onCloseDetail={() => setSelectedIso(null)}
        detailTitle="Comenzile zilei"
        list={
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {ordersQuery.isError ? (
              <ErrorNotice
                message="Nu s-au putut prelua comenzile."
                onRetry={() => void ordersQuery.refetch()}
              />
            ) : ordersQuery.isLoading ? (
              view === 'agenda' ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 35 }, (_, index) => (
                    <Skeleton key={index} className="h-[6.5rem] rounded-xl" />
                  ))}
                </div>
              )
            ) : view === 'agenda' ? (
              <MonthAgenda
                cells={cells}
                buckets={buckets}
                selectedIso={selectedIso}
                onSelectDay={setSelectedIso}
                emptyLabel={`Nicio comandă în ${monthLabel(monthIso).toLowerCase()}${
                  typeFilter ? ` pentru ${ORDER_TYPE_LABELS[typeFilter].toLowerCase()}` : ''
                }.`}
              />
            ) : (
              <>
                <MonthGrid
                  cells={cells}
                  buckets={buckets}
                  selectedIso={selectedIso}
                  onSelectDay={setSelectedIso}
                />
                {/* The grid stays: an empty month is still a month someone is
                    looking at, and swapping it for an empty state would hide
                    the dates they came to check. */}
                {total === 0 && (
                  <p className="mt-4 text-center text-sm text-ink-muted">
                    Nicio comandă în {monthLabel(monthIso).toLowerCase()}
                    {typeFilter ? ` pentru ${ORDER_TYPE_LABELS[typeFilter].toLowerCase()}` : ''}.
                  </p>
                )}
              </>
            )}
          </div>
        }
        detail={
          selectedIso !== null &&
          selectedBucket && (
            <DayOrdersPane
              key={selectedIso}
              iso={selectedIso}
              orders={selectedBucket.orders}
              onOpenOrder={openOrder}
            />
          )
        }
      />
    </Workbench>
  );
}
