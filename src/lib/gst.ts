/**
 * GST added at checkout on top of every product's list price (listed prices
 * exclude it). The backend adds the same GST to the amount it charges, in its
 * own src/config/tax.ts — change both together.
 */
export const GST_PERCENT = 18;

/**
 * Splits a rupee subtotal into GST and the amount payable. Works in whole
 * paise and rounds the way the backend does, so the cart shows exactly what
 * Razorpay will charge.
 */
export function withGst(subtotal: number) {
  const subtotalPaise = Math.round(subtotal * 100);
  const gstPaise = Math.round((subtotalPaise * GST_PERCENT) / 100);
  return {
    subtotal: subtotalPaise / 100,
    gst: gstPaise / 100,
    total: (subtotalPaise + gstPaise) / 100,
  };
}
