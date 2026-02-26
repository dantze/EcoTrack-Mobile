/** Days of the week (1=Monday ... 7=Sunday), Romanian labels */
export const DAYS_OF_WEEK = [
    { value: 1, label: 'Luni' },
    { value: 2, label: 'Marți' },
    { value: 3, label: 'Miercuri' },
    { value: 4, label: 'Joi' },
    { value: 5, label: 'Vineri' },
    { value: 6, label: 'Sâmbătă' },
    { value: 7, label: 'Duminică' },
] as const;

/** Map from dayOfWeek number to Romanian label */
const DAYS_MAP: { [key: number]: string } = {
    1: 'Luni',
    2: 'Marți',
    3: 'Miercuri',
    4: 'Joi',
    5: 'Vineri',
    6: 'Sâmbătă',
    7: 'Duminică',
};

/**
 * Convert a dayOfWeek number (1-7) to a Romanian day name.
 * Returns the fallback string if dayOfWeek is undefined or not found.
 */
export const getDayOfWeekLabel = (dayOfWeek?: number, fallback: string = 'N/A'): string => {
    if (!dayOfWeek) return fallback;
    return DAYS_MAP[dayOfWeek] || fallback;
};

/** Short Romanian day names (Sunday-first, matching JS Date.getDay()) */
export const DAY_NAMES_SHORT = ['DU', 'LU', 'MA', 'MI', 'JO', 'VI', 'SÂ'] as const;

/** Romanian counties list */
export const COUNTIES = [
    'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani',
    'Brașov', 'Brăila', 'București', 'Buzău', 'Caraș-Severin', 'Călărași',
    'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
    'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș',
    'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare', 'Sălaj',
    'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea',
] as const;
