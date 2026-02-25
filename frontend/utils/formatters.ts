/**
 * Shared formatting / validation utilities used across the app.
 */

/** Format a number as Romanian price string, e.g. "1.250 RON" */
export const formatPrice = (price: number): string =>
    price.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' RON';

/** Validate that a name string is non-empty. Returns error message or null. */
export const validateRequired = (value: string, fieldLabel: string): string | null => {
    if (!value.trim()) return `${fieldLabel} este obligatoriu.`;
    return null;
};

/** Validate that a string is a valid positive number. Returns error message or null. */
export const validatePositiveNumber = (value: string, fieldLabel: string): string | null => {
    const num = parseFloat(value);
    if (!value.trim() || isNaN(num) || num < 0) {
        return `${fieldLabel} trebuie să fie un număr valid pozitiv.`;
    }
    return null;
};

/** Validate that a string is a valid positive integer >= 1. Returns error message or null. */
export const validatePositiveInt = (value: string, fieldLabel: string): string | null => {
    const num = parseInt(value, 10);
    if (!value.trim() || isNaN(num) || num < 1) {
        return `${fieldLabel} trebuie să fie un număr întreg valid (min. 1).`;
    }
    return null;
};
