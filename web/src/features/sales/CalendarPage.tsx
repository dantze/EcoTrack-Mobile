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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageHeader, Select, Skeleton, type SelectOption } from '@/components/ui';
import { ORDER_TYPE_LABELS, orderCountLabel } from '@/components/domain';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import { useDeepLink } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { ErrorNotice, FilterBar, FilterField } from './components/FilterBar';
import { DayOrdersDrawer } from './components/DayOrdersDrawer';
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
  const deepLink = useDeepLink();
  const linkedDay = deepLink.raw('zi');

  useEffect(() => {
    if (linkedDay === null || !ISO_DATE.test(linkedDay)) return;
    setMonthIso(monthStartIso(new Date(`${linkedDay}T00:00:00`)));
    setSelectedIso(linkedDay);
    deepLink.clear('zi');
  }, [linkedDay, deepLink]);

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

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={
          ordersQuery.isLoading
            ? 'Se încarcă…'
            : `${orderCountLabel(total)} în ${monthLabel(monthIso).toLowerCase()}${
                typeFilter ? ` · doar ${ORDER_TYPE_LABELS[typeFilter]}` : ''
              }`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void ordersQuery.refetch()}
              loading={ordersQuery.isFetching}
            >
              Reîmprospătează
            </Button>
            <Button variant="primary" onClick={() => navigate('/comenzi?nou=1')}>
              + Comandă
            </Button>
          </>
        }
      />

      <FilterBar>
        <div className="flex items-center gap-1">
          <Button variant="ghost" iconOnly onClick={() => step(-1)} aria-label="Luna anterioară">
            ‹
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold text-ink">
            {monthLabel(monthIso)}
          </span>
          <Button variant="ghost" iconOnly onClick={() => step(1)} aria-label="Luna următoare">
            ›
          </Button>
          <Button variant="secondary" onClick={goToday}>
            Azi
          </Button>
        </div>
        <FilterField label="Tip">
          <div className="w-40">
            <Select value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
          </div>
        </FilterField>
        {typeFilter && (
          <Button variant="ghost" onClick={() => setTypeFilter('')}>
            Resetează
          </Button>
        )}
      </FilterBar>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {ordersQuery.isError ? (
          <ErrorNotice
            message="Nu s-au putut prelua comenzile."
            onRetry={() => void ordersQuery.refetch()}
          />
        ) : ordersQuery.isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, index) => (
              <Skeleton key={index} className="h-[6.5rem] rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <MonthGrid
              cells={cells}
              buckets={buckets}
              selectedIso={selectedIso}
              onSelectDay={setSelectedIso}
            />
            {/* The grid stays: an empty month is still a month someone is
                looking at, and swapping it for an empty state would hide the
                dates they came to check. */}
            {total === 0 && (
              <p className="mt-4 text-center text-sm text-ink-muted">
                Nicio comandă în {monthLabel(monthIso).toLowerCase()}
                {typeFilter ? ` pentru ${ORDER_TYPE_LABELS[typeFilter].toLowerCase()}` : ''}.
              </p>
            )}
          </>
        )}
      </div>

      {selectedIso !== null && selectedBucket && (
        <DayOrdersDrawer
          key={selectedIso}
          iso={selectedIso}
          orders={selectedBucket.orders}
          onClose={() => setSelectedIso(null)}
          onOpenOrder={openOrder}
        />
      )}
    </>
  );
}
