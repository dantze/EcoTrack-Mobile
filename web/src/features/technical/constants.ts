/**
 * Static option lists for the Technical module.
 *
 * Romanian counties and weekday options are carried over from the mobile app's
 * `constants/RouteConstants.ts`. Enum labels are NOT duplicated here — those
 * live in `@/components/domain`.
 */

import type { SelectOption } from '@/components/ui';
import { WEEKDAY_LABELS } from '@/components/domain';
import { TASK_STATUSES, TASK_TYPES } from '@/types/domain';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/components/domain';

/** Sentinel used by filter selects to mean "no filter". */
export const ALL = 'ALL';

export const COUNTIES: readonly string[] = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani',
  'Brașov', 'Brăila', 'București', 'Buzău', 'Caraș-Severin', 'Călărași',
  'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
  'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș',
  'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare', 'Sălaj',
  'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea',
  'Vrancea',
];

export const COUNTY_OPTIONS: SelectOption<string>[] = COUNTIES.map((county) => ({
  value: county,
  label: county,
}));

/** 1 = Monday … 7 = Sunday, per java.time.DayOfWeek. */
export const WEEKDAY_OPTIONS: SelectOption<string>[] = WEEKDAY_LABELS.map((label, index) => ({
  value: String(index + 1),
  label,
}));

export const TASK_STATUS_OPTIONS: SelectOption<string>[] = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_LABELS[status],
}));

export const TASK_TYPE_OPTIONS: SelectOption<string>[] = TASK_TYPES.map((type) => ({
  value: type,
  label: TASK_TYPE_LABELS[type],
}));

/** Frequencies the sales flow offers for recurring sanitation plans. */
export const FREQUENCY_LABELS: Record<number, string> = {
  7: 'Săptămânal',
  14: 'La 2 săptămâni',
  21: 'La 3 săptămâni',
  30: 'Lunar',
};
