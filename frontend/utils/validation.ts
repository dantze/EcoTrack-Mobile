/**
 * Shared form validation utilities.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+?0?407\d{8}|07\d{8})$/;

/** Returns true when the email matches a basic XX@XX.XX pattern. */
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email.trim());

/** Returns true when the phone matches a Romanian mobile format: 07XXXXXXXX, 407XXXXXXXX, +407XXXXXXXX or 0407XXXXXXXX. */
export const isValidPhone = (phone: string): boolean => PHONE_REGEX.test(phone.trim());
