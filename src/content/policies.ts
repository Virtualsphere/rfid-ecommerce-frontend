/**
 * ⚠ POLICY TERMS — REVIEW BEFORE LAUNCH
 *
 * The numbers and promises behind the Return & Refund and Shipping & Delivery
 * pages. Nothing in the codebase or the backend records these (the cart says
 * "Shipping: Calculated at checkout" but computes nothing), so each value below
 * is a conventional default for an Indian hardware seller, written so the pages
 * read correctly — not a decision the business has made.
 *
 * These are commitments to customers. Change any figure to match what the
 * business really does; the pages read from here, so one edit updates both.
 * The checkout thank-you page also quotes `SHIPPING.processingTime`.
 */

/** When the policy pages were last changed (ISO date). Bump it when you edit them. */
export const POLICIES_UPDATED = "2026-10-10";

export const RETURNS = {
  /** Days after delivery within which an unused item can be returned. */
  windowDays: 7,
  /** Hours after delivery within which a damaged, defective or wrong item must be reported. */
  damageReportHours: 48,
  /** How long a refund takes once the returned item has been received and inspected. */
  refundTime: "5–7 business days",
} as const;

export const SHIPPING = {
  /** Time between payment and the parcel being handed to the courier. */
  processingTime: "1–2 business days",
  /** Transit time once dispatched, by destination. */
  transit: [
    { destination: "Delhi NCR and metro cities", time: "2–4 business days" },
    { destination: "Rest of India", time: "4–8 business days" },
  ],
  /** Where orders ship. */
  coverage: "addresses across India",
} as const;
