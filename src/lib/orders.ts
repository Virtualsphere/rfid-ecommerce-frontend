/**
 * The short reference a customer sees and quotes: the last 8 characters of the
 * order's id, upper-cased. The admin orders table shows the same characters.
 */
export function orderNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

/** The thank-you page checkout lands on once an order's payment is verified. */
export function orderConfirmationPath(orderId: string): string {
  return `/checkout/thank-you?order=${encodeURIComponent(orderId)}`;
}
