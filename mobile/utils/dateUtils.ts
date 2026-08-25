// ─── Date formatting utilities ────────────────────────────────────────────────

/**
 * Convert a Date to 'YYYY-MM-DD' string (used for API calls and calendar components).
 */
export const toDateString = (date: Date): string =>
    date.toISOString().split('T')[0];

/**
 * Format a Date for display in Romanian locale.
 * @param date        The Date object to format.
 * @param includeYear Whether to include the year (default: true).
 */
export const formatDisplayDate = (
    date: Date,
    includeYear: boolean = true,
): string => {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(includeYear && { year: 'numeric' }),
    };
    return date.toLocaleDateString('ro-RO', options);
};

/**
 * Parse a date string and format it for display.
 * Returns the original string on failure.
 */
export const formatDateString = (
    dateStr: string | undefined | null,
    includeYear: boolean = true,
): string => {
    if (!dateStr) return '';
    try {
        return formatDisplayDate(new Date(dateStr), includeYear);
    } catch {
        return dateStr;
    }
};
