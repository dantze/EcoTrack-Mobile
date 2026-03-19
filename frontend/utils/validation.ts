/**
 * Shared form validation utilities.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns true when the email matches a basic XX@XX.XX pattern. */
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email.trim());

/** Returns true when the phone contains only digits and is between 4–15 characters long. */
export const isValidPhoneDigits = (phone: string): boolean => {
    const trimmed = phone.trim();
    return /^\d{4,15}$/.test(trimmed);
};
