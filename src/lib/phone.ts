/**
 * Phone numbers as people type them: digits, optionally with a leading +,
 * spaces, dashes, dots or brackets. "+91 98765-43210" and "(022) 2345 6789"
 * both qualify.
 */
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

/** The digits of a phone number, with every separator dropped. */
export const phoneDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Whether `value` looks like a reachable phone number: 10 to 15 digits, the
 * range from an Indian number without its country code to the longest E.164
 * number. A shorter number abroad needs its country code to qualify.
 *
 * RFID-BACKEND's enquiryController applies the same rule.
 */
export function isPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  const digits = phoneDigits(trimmed).length;
  return PHONE_CHARACTERS.test(trimmed) && digits >= 10 && digits <= 15;
}

/**
 * The 10 digits of an Indian mobile number, or null when `value` isn't one.
 * Accepts the forms people use: with or without +91/91, or a leading 0.
 */
export function indianMobile(value: string): string | null {
  if (!PHONE_CHARACTERS.test(value.trim())) return null;
  let digits = phoneDigits(value);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** "+91 98765 43210", the way the number is stored on an order. */
export const formatIndianMobile = (digits: string) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
