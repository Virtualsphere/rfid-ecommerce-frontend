import { sendGTMEvent } from "@next/third-parties/google";

/**
 * The `purchase` event the checkout thank-you page pushes into Google Tag
 * Manager's dataLayer, for the Google Ads conversion tag (and GA4) to read.
 *
 * It follows GA4's ecommerce shape, so in GTM the values are Data Layer
 * Variables `ecommerce.transaction_id`, `ecommerce.value` and
 * `ecommerce.currency`, and a Custom Event trigger on `purchase` fires the tags.
 * See https://developers.google.com/tag-platform/tag-manager/datalayer
 */

export const PURCHASE_CURRENCY = "INR";

/** The fields of an order (GET /orders/myorders) the event is built from. */
export type PurchasedOrder = {
  _id: string;
  /** What was paid, GST included. */
  totalPrice: number;
  /** The products before GST. Missing on orders placed before GST was added. */
  subtotal?: number;
  gstAmount?: number;
  paymentStatus?: string;
  items: {
    quantity: number;
    priceAtPurchase: number;
    product: {
      _id: string;
      sku?: string;
      name: string;
      category?: { name: string } | null;
    } | null;
  }[];
};

const rupees = (amount: number) => Math.round(amount * 100) / 100;

/**
 * The dataLayer message for a placed order. `value` is the products before
 * GST, like the listed prices and the Google Ads conversion the cart fires;
 * the GST goes in `tax`. Shipping is free, so `shipping` is always 0.
 */
export function purchaseEvent(order: PurchasedOrder) {
  const tax = order.gstAmount ?? 0;
  return {
    event: "purchase",
    ecommerce: {
      transaction_id: order._id,
      value: rupees(order.subtotal ?? order.totalPrice - tax),
      tax: rupees(tax),
      shipping: 0,
      currency: PURCHASE_CURRENCY,
      items: order.items.flatMap((item) =>
        item.product
          ? [
              {
                item_id: item.product.sku || item.product._id,
                item_name: item.product.name,
                ...(item.product.category?.name && { item_category: item.product.category.name }),
                price: rupees(item.priceAtPurchase),
                quantity: item.quantity,
              },
            ]
          : []
      ),
    },
  };
}

/* ─── Once per order ──────────────────────────────────────────────────────
 * The thank-you page also works after a refresh or from a bookmark, and each
 * load would otherwise count the sale again. Orders already reported are
 * remembered in this browser; the in-memory set covers storage being blocked
 * and React running effects twice in development.
 */

const REPORTED_KEY = "purchases-reported";
/** Enough to cover any one customer's recent orders without growing forever. */
const REPORTED_LIMIT = 20;
const reportedThisSession = new Set<string>();

function storedReported(): string[] {
  try {
    const list: unknown = JSON.parse(window.localStorage.getItem(REPORTED_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberReported(orderId: string) {
  reportedThisSession.add(orderId);
  try {
    const list = [...storedReported().filter((id) => id !== orderId), orderId].slice(-REPORTED_LIMIT);
    window.localStorage.setItem(REPORTED_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked or full: the in-memory set still stops repeats on this page.
  }
}

/**
 * Pushes the `purchase` event for a paid order, unless this browser already
 * has. Returns whether it pushed.
 */
export function reportPurchase(order: PurchasedOrder): boolean {
  if (typeof window === "undefined" || order.paymentStatus !== "Paid") return false;
  if (reportedThisSession.has(order._id) || storedReported().includes(order._id)) return false;

  rememberReported(order._id);
  // Clear the previous ecommerce object first: GTM merges pushes into one
  // model, so an earlier event's items would otherwise leak into this one.
  sendGTMEvent({ ecommerce: null });
  sendGTMEvent(purchaseEvent(order));
  return true;
}

/** Tests only: forget the orders reported in this module's lifetime. */
export function resetReportedForTests() {
  reportedThisSession.clear();
}
