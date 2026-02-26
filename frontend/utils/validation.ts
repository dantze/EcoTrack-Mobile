/**
 * Shared form validation utilities.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+40\d{9}|0\d{9})$/;

/** Returns true when the email matches a basic XX@XX.XX pattern. */
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email.trim());

/** Returns true when the phone matches a Romanian format: 0XXXXXXXXX or +40XXXXXXXXX. */
export const isValidPhone = (phone: string): boolean => PHONE_REGEX.test(phone.trim());
