import { ApiError } from "./api";
import { GST_PERCENT, withGst } from "./gst";
import { formatCurrency } from "./utils";

/**
 * Razorpay Standard Checkout: the script loader, the payment window, and the
 * wording for what can go wrong before it opens.
 *
 * The flow is: the backend creates a Razorpay order (`POST /orders`), the
 * window here collects the payment for that order, and the backend then checks
 * the signature Razorpay returns (`POST /payment/verify`).
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpayPayment = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open(): void;
  on(event: "payment.failed", callback: (response: { error?: { description?: string } }) => void): void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
    gtag?: (...args: unknown[]) => void;
  }
}

let pendingLoad: Promise<boolean> | null = null;

/** Load Razorpay's script once. Resolves false if it can't be loaded (offline, blocked). */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  pendingLoad ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      // Forget the failure, so a later attempt (back online) can try again.
      pendingLoad = null;
      script.remove();
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return pendingLoad;
}

export type CheckoutOptions = {
  keyId: string;
  /** Razorpay's id for the order the backend created. */
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  themeColor: string;
  prefill?: { name?: string; email?: string; contact?: string };
};

export type CheckoutHandlers = {
  onPaid: (payment: RazorpayPayment) => void;
  /** The customer closed the window without paying. */
  onDismiss: () => void;
  /** An attempt was declined. The window stays open, so they can try another way. */
  onFailed: (reason: string) => void;
};

/** Open the payment window. Call `loadRazorpay()` first. */
export function openCheckout(options: CheckoutOptions, handlers: CheckoutHandlers): void {
  if (!window.Razorpay) throw new Error("Razorpay checkout has not loaded");

  const checkout = new window.Razorpay({
    key: options.keyId,
    amount: options.amountPaise,
    currency: "INR",
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: options.prefill,
    theme: { color: options.themeColor },
    handler: handlers.onPaid,
    modal: { ondismiss: handlers.onDismiss },
  });
  checkout.on("payment.failed", (response) =>
    handlers.onFailed(response.error?.description || "The payment was declined.")
  );
  checkout.open();
}

/**
 * The line under the store name in the payment window. When the amount
 * Razorpay holds is the products plus GST, it spells out the split
 * ("Products ₹1,000 + 18% GST ₹180"), since the site lists prices without GST.
 * Any other amount (a backend that doesn't add GST, a price that changed since
 * the cart loaded) gets the plain line rather than a split that doesn't add up.
 */
export function paymentDescription(productsTotal: number, amountPaise: number): string {
  const { subtotal, gst, total } = withGst(productsTotal);
  if (subtotal > 0 && Math.round(total * 100) === amountPaise) {
    return `Products ${formatCurrency(subtotal)} + ${GST_PERCENT}% GST ${formatCurrency(gst)}`;
  }
  return "RFID Order Payment";
}

/** What to tell a customer when starting the payment failed. */
export function checkoutErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 503) {
      return "Online payments are temporarily unavailable. Please call or WhatsApp us to place your order.";
    }
    // The backend explains its own refusals ("No items in cart") and the
    // proxy explains an unreachable backend; both are worth showing as-is.
    // A bare 500 ("Server Error") says nothing, so it falls through.
    if (error.status && (error.status < 500 || error.status === 502)) return error.message;
  }
  return "We couldn't start your payment. Please try again, or call or WhatsApp us to place your order.";
}
