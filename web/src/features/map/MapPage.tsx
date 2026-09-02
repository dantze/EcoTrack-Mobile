/**
 * Hartă — every order that has a location, on one canvas, with the routes that
 * serve them drawn over the top.
 *
 * This screen exists because the dispatch board already reasons about geography
 * it could never show: `features/technical/grouping.ts` clusters jobs within
 * 25 km and re-sequences stops by real haversine distance, and until now a
 * dispatcher had to take all of that on faith. Everything here is a *view* over
 * that same geometry — no new API surface, no new contract method, just
 * `orders.list()` / `tasks.list()` / `routes.list()` re-projected.
 *
 * Composition, deliberately three-way:
 *   - `data.ts`            pure projection + statistics, unit-tested, no WebGL
 *   - `components/MapCanvas` MapLibre rendering, knows nothing about Order/Task
 *   - this file            filters, stat rail, selection, URL and keyboard
 *
 * The seam between the first two is `types.ts`, which is why neither imports
 * the other and why the projection is testable without a browser.
 *
 * `?comanda=<id>` selects that order on the map — the same param OrdersPage
 * uses for its drawer, so a link pasted into chat opens the record either way.
 */

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, DateInput, EmptyState, Select, TextInput, cx } from '@/components/ui';
import { CommandBar, PaneHeader, ToolbarGroup, Workbench } from '@/components/layout';
import { Toggle } from '@/components/shadcn/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group';
import { ORDER_TYPE_LABELS } from '@/components/domain';
import { useDeepLink, useDeepLinkOnce } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { useAuth } from '@/auth';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import { useOrders } from '@/features/sales/queries';
import { useRoutes, useTasks } from '@/features/technical/queries';
import { todayIso } from '@/features/technical/utils';
import { buildMapData } from './data';
import { MapCanvas } from './components/MapCanvas';
import {
  EMPTY_FILTERS,
  LIFECYCLES,
  LIFECYCLE_COLOR,
  LIFECYCLE_LABEL,
  ORDER_TYPE_COLOR,
  type CountBucket,
  type Lifecycle,
  type MapBounds,
  type MapFilters,
  type MapPoint,
  type MapStats,
} from './types';

/** DOM id so the "/" shortcut can put the cursor in the search box. */
const SEARCH_FIELD_ID = 'map-search';
const ALL_COUNTIES = '__all__';

export function MapPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isTech = hasRole('TECH');

  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const [colorBy, setColorBy] = useState<'orderType' | 'lifecycle'>('lifecycle');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showRoutes, setShowRoutes] = useState(isTech);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Reads are open to any authenticated employee (see the role matrix in
  // SecurityConfig), and the whole point of this screen is the cross-module
  // view — a dispatcher looking at sales orders is the use case, not a leak.
  // Route lines are the one thing gated, because they are meaningless to Sales.
  const ordersQuery = useOrders();
  const tasksQuery = useTasks({ enabled: isTech });
  const routesQuery = useRoutes({ enabled: isTech });

  const today = todayIso();

  const data = useMemo(
    () =>
      buildMapData({
        orders: ordersQuery.data ?? [],
        tasks: tasksQuery.data ?? [],
        routes: routesQuery.data ?? [],
        filters,
        today,
      }),
    [ordersQuery.data, tasksQuery.data, routesQuery.data, filters, today],
  );

  // buildMapData returns a fresh bounds object every run, so passing it straight
  // through would re-fit the viewport on every refetch and fight the operator
  // for control of the camera. Only hand the canvas a NEW object when the
  // numbers actually change.
  const bounds = useStableBounds(data.bounds);

  const selected = useMemo(
    () => data.points.find((point: MapPoint) => point.id === selectedPointId) ?? null,
    [data.points, selectedPointId],
  );

  useDeepLinkOnce('comanda', useDeepLink().number('comanda'), (orderId) => {
    setSelectedPointId(`order:${orderId}`);
    recordUse('order', orderId);
  });

  useShortcuts([
    {
      combo: '/',
      description: 'Focus pe câmpul de căutare',
      group: 'Hartă',
      run: () => document.getElementById(SEARCH_FIELD_ID)?.focus(),
    },
    {
      combo: 'h',
      description: 'Comută harta de densitate',
      group: 'Hartă',
      run: () => setShowHeatmap((current) => !current),
    },
    {
      combo: 'l',
      description: 'Comută traseele rutelor',
      group: 'Hartă',
      run: () => setShowRoutes((current) => !current),
    },
    {
      combo: 'x',
      description: 'Resetează filtrele',
      group: 'Hartă',
      run: () => setFilters(EMPTY_FILTERS),
    },
    {
      combo: 'r',
      description: 'Reîncarcă datele',
      group: 'Hartă',
      run: () => void ordersQuery.refetch(),
    },
  ]);

  const patch = (next: Partial<MapFilters>) => setFilters((current) => ({ ...current, ...next }));

  const toggleIn = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const countyOptions = useMemo(
    () => [
      { value: ALL_COUNTIES, label: 'Toate județele' },
      ...data.stats.byCounty.map((bucket: CountBucket) => ({
        value: bucket.key,
        label: `${bucket.label} (${bucket.count})`,
      })),
    ],
    [data.stats.byCounty],
  );

  const loading = ordersQuery.isPending || (isTech && routesQuery.isPending);
  const filtersActive =
    filters.orderTypes.length > 0 ||
    filters.lifecycles.length > 0 ||
    filters.counties.length > 0 ||
    filters.query.trim() !== '' ||
    filters.from !== null ||
    filters.to !== null;

  // The two layer switches are a segmented toggle rather than two buttons
  // that flip variant: a ribbon states a mode by keeping it pressed, and
  // aria-pressed says out loud what "the blue one is on" only implied.
  const layers = [showHeatmap ? 'heatmap' : null, showRoutes ? 'routes' : null].filter(
    (layer): layer is string => layer !== null,
  );

  return (
    <Workbench>
      <CommandBar
        title="Hartă"
        subtitle={
          loading
            ? 'Se încarcă…'
            : `${data.stats.plotted} comenzi pe hartă · ${data.stats.totalQuantity} unități` +
              (isTech ? ` · ${data.stats.routes.count} rute` : '')
        }
        actions={
          <ToolbarGroup>
            <ToggleGroup
              type="multiple"
              size="sm"
              variant="outline"
              value={layers}
              onValueChange={(next: string[]) => {
                setShowHeatmap(next.includes('heatmap'));
                if (isTech) setShowRoutes(next.includes('routes'));
              }}
              aria-label="Straturi hartă"
            >
              <ToggleGroupItem value="heatmap">Densitate</ToggleGroupItem>
              {isTech && <ToggleGroupItem value="routes">Trasee</ToggleGroupItem>}
            </ToggleGroup>
          </ToolbarGroup>
        }
        tools={
          <Select
            aria-label="Colorează după"
            value={colorBy}
            options={[
              { value: 'lifecycle', label: 'După stare' },
              { value: 'orderType', label: 'După tip' },
            ]}
            onChange={(value) => setColorBy(value as 'orderType' | 'lifecycle')}
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* A pane, not a page section: the same surface, hairline and header
            height as the reading pane every other screen puts here. Hidden
            below md, where the map itself is all there is room for. */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface md:flex xl:w-80">
          <PaneHeader
            title="Filtre"
            subtitle={filtersActive ? 'Filtre active' : 'Toate comenzile'}
            actions={
              filtersActive ? (
                <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Resetează
                </Button>
              ) : undefined
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FilterPanel
              filters={filters}
              countyOptions={countyOptions}
              onPatch={patch}
              onToggleType={(type) => patch({ orderTypes: toggleIn(filters.orderTypes, type) })}
              onToggleLifecycle={(life) => patch({ lifecycles: toggleIn(filters.lifecycles, life) })}
            />

            {selected ? (
              <SelectedPanel
                point={selected}
                onClose={() => setSelectedPointId(null)}
                onOpenOrder={() => {
                  recordUse('order', selected.orderId);
                  navigate(`/comenzi?comanda=${selected.orderId}`);
                }}
              />
            ) : (
              <StatsPanel stats={data.stats} showRoutes={isTech} />
            )}
          </div>
        </aside>

        <div className="relative min-w-0 flex-1">
          {!loading && data.points.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                title={filtersActive ? 'Nicio comandă pentru filtrele curente' : 'Nicio comandă de afișat'}
                body={
                  filtersActive
                    ? 'Ajustează filtrele sau resetează-le.'
                    : 'Comenzile apar aici de îndată ce au coordonate.'
                }
                action={
                  filtersActive ? (
                    <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                      Resetează filtrele
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <MapCanvas
              className="h-full w-full"
              points={data.points}
              routes={showRoutes ? data.routes : []}
              colorBy={colorBy}
              showHeatmap={showHeatmap}
              showRoutes={showRoutes}
              selectedPointId={selectedPointId}
              onSelectPoint={setSelectedPointId}
              bounds={bounds}
            />
          )}
        </div>
      </div>
    </Workbench>
  );
}

/**
 * Returns a bounds object whose identity changes only when its numbers do.
 * Writing through a ref during render is the standard idiom for deriving a
 * stable reference; there is no state to synchronise and no effect to schedule.
 *
 * The rule is disabled for this function alone rather than for the file
 * (TODO-26): the argument above is why, and it holds here and nowhere else —
 * the ref is read and written in the same render pass, never across one, so a
 * render React discards takes its ref write with it. Twenty-six warnings from
 * twelve lines was the whole of this rule’s noise in the feature layer, and
 * leaving it as noise is what stops the next real one from being seen.
 */
/* eslint-disable react-hooks/refs -- deliberate, and scoped to this hook only */
function useStableBounds(next: MapBounds | null): MapBounds | null {
  const held = useRef<MapBounds | null>(null);
  const same =
    held.current === next ||
    (held.current !== null &&
      next !== null &&
      held.current.west === next.west &&
      held.current.south === next.south &&
      held.current.east === next.east &&
      held.current.north === next.north);
  if (!same) held.current = next;
  return held.current;
}
/* eslint-enable react-hooks/refs */

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3.5">
      <h3 className="mb-2.5 text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A colour-swatched toggle. Used for both order type and lifecycle. */
function Chip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Toggle
      size="sm"
      pressed={active}
      onPressedChange={onClick}
      className={cx(
        'h-7 gap-1.5 rounded-full border px-2.5 text-xs font-normal',
        active
          ? 'border-primary bg-accent-50 text-ink data-[state=on]:bg-accent-50 data-[state=on]:text-ink'
          : 'border-border bg-surface text-ink-muted hover:bg-surface-hover',
      )}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </Toggle>
  );
}

function FilterPanel({
  filters,
  countyOptions,
  onPatch,
  onToggleType,
  onToggleLifecycle,
}: {
  filters: MapFilters;
  countyOptions: { value: string; label: string }[];
  onPatch: (next: Partial<MapFilters>) => void;
  onToggleType: (type: OrderTypeTag) => void;
  onToggleLifecycle: (life: Lifecycle) => void;
}) {
  return (
    <>
      <PanelSection title="Căutare">
        <TextInput
          id={SEARCH_FIELD_ID}
          aria-label="Caută pe hartă"
          placeholder="client, adresă, număr…"
          value={filters.query}
          onChange={(event) => onPatch({ query: event.target.value })}
        />
      </PanelSection>

      <PanelSection title="Tip comandă">
        <div className="flex flex-wrap gap-1.5">
          {ORDER_TYPES.map((type) => (
            <Chip
              key={type}
              label={ORDER_TYPE_LABELS[type]}
              color={ORDER_TYPE_COLOR[type]}
              active={filters.orderTypes.includes(type)}
              onClick={() => onToggleType(type)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Stare">
        <div className="flex flex-wrap gap-1.5">
          {LIFECYCLES.map((life) => (
            <Chip
              key={life}
              label={LIFECYCLE_LABEL[life]}
              color={LIFECYCLE_COLOR[life]}
              active={filters.lifecycles.includes(life)}
              onClick={() => onToggleLifecycle(life)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Județ">
        <Select
          aria-label="Județ"
          value={filters.counties[0] ?? ALL_COUNTIES}
          options={countyOptions}
          onChange={(value) => onPatch({ counties: value === ALL_COUNTIES ? [] : [value] })}
        />
      </PanelSection>

      <PanelSection title="Interval">
        <div className="flex flex-col gap-2">
          <DateInput
            aria-label="De la"
            value={filters.from}
            onChange={(value) => onPatch({ from: value })}
          />
          <DateInput aria-label="Până la" value={filters.to} onChange={(value) => onPatch({ to: value })} />
        </div>
      </PanelSection>

      {/* No reset button here: the pane header carries it now, where it is
          visible without scrolling past six filter sections to find it. */}
    </>
  );
}

/** Horizontal proportion bar. Reads at a glance without needing a chart library. */
function StatBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-ink-muted">{label}</span>
        <span className="tabular shrink-0 font-medium text-ink">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatsPanel({ stats, showRoutes }: { stats: MapStats; showRoutes: boolean }) {
  return (
    <>
      {stats.dropped > 0 && (
        <div className="border-b border-warning-200 bg-warning-50 px-4 py-3">
          <p className="text-xs font-medium text-warning-700">
            {stats.dropped} comenzi fără coordonate
          </p>
          <p className="mt-0.5 text-xs text-warning-700">
            {Math.round(stats.droppedRatio * 100)}% din toate comenzile nu pot fi afișate, indiferent
            de filtre. Harta nu este completă.
          </p>
        </div>
      )}

      <PanelSection title="Stare">
        {stats.byLifecycle.map((bucket) => (
          <StatBar
            key={bucket.key}
            label={bucket.label}
            count={bucket.count}
            total={stats.plotted}
            color={LIFECYCLE_COLOR[bucket.key as Lifecycle] ?? '#94a3b8'}
          />
        ))}
      </PanelSection>

      <PanelSection title="Tip comandă">
        {stats.byOrderType.map((bucket) => (
          <StatBar
            key={bucket.key}
            // data.ts buckets carry the raw wire tag ("Amplasari"); the chips
            // above use the app's label map, so translate here to match.
            label={ORDER_TYPE_LABELS[bucket.key as OrderTypeTag] ?? bucket.label}
            count={bucket.count}
            total={stats.plotted}
            color={ORDER_TYPE_COLOR[bucket.key as OrderTypeTag] ?? '#94a3b8'}
          />
        ))}
      </PanelSection>

      {stats.topSites.length > 0 && (
        <PanelSection title="Cele mai active locații">
          <ul className="flex flex-col gap-1.5">
            {stats.topSites.map((site) => (
              <li key={site.key} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-ink-muted">{site.label}</span>
                <span className="tabular shrink-0 font-medium text-ink">
                  {site.quantity} buc · {site.count}
                </span>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      {showRoutes && (
        <PanelSection title="Rute">
          <dl className="flex flex-col gap-1.5 text-xs">
            <Row label="Rute afișate" value={String(stats.routes.count)} />
            <Row label="Opriri" value={String(stats.routes.stops)} />
            <Row label="Distanță (linie dreaptă)" value={`${Math.round(stats.routes.totalKm)} km`} />
            <Row label="Sarcini neasignate" value={String(stats.routes.unassignedTasks)} />
          </dl>
          <p className="mt-2 text-[0.6875rem] leading-snug text-ink-subtle">
            Distanțele sunt în linie dreaptă, nu pe șosea.
          </p>
        </PanelSection>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-ink-muted">{label}</dt>
      <dd className="tabular shrink-0 font-medium text-ink">{value}</dd>
    </div>
  );
}

function SelectedPanel({
  point,
  onClose,
  onOpenOrder,
}: {
  point: MapPoint;
  onClose: () => void;
  onOpenOrder: () => void;
}) {
  return (
    <div className="flex-1">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{point.clientName}</p>
          <p className="mt-0.5 text-xs text-ink-muted">#{point.orderNumber}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Închide
        </Button>
      </div>

      <PanelSection title="Detalii">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          <Badge>{ORDER_TYPE_LABELS[point.orderType]}</Badge>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-white"
            style={{ backgroundColor: LIFECYCLE_COLOR[point.lifecycle] }}
          >
            {LIFECYCLE_LABEL[point.lifecycle]}
          </span>
        </div>
        <dl className="flex flex-col gap-1.5 text-xs">
          <Row label="Adresă" value={point.address ?? '—'} />
          <Row label="Județ" value={point.county ?? '—'} />
          <Row label="Dată" value={point.date ?? '—'} />
          {point.quantity !== null && <Row label="Cantitate" value={`${point.quantity} buc`} />}
          {point.productName && <Row label="Produs" value={point.productName} />}
        </dl>
      </PanelSection>

      <div className="px-4 py-3">
        <Button variant="primary" size="sm" className="w-full" onClick={onOpenOrder}>
          Deschide comanda
        </Button>
      </div>
    </div>
  );
}
