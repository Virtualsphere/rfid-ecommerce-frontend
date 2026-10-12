"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, createOrder, verifyRazorpayPayment } from "@/lib/api";
import { RAZORPAY_KEY_ID } from "@/lib/config";
import { checkoutErrorMessage, loadRazorpay, openCheckout } from "@/lib/razorpay";
import { orderConfirmationPath } from "@/lib/orders";
import { useSlowHint } from "@/lib/use-slow-hint";
import { cn, formatCurrency } from "@/lib/utils";
import { GST_NOTE } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shared/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { ProductMedia } from "@/components/shared/product-image";
import { StockBadge } from "@/components/shared/status-badge";
import { QuantityStepper } from "@/components/shared/quantity-stepper";

/** Razorpay's checkout accent. It only accepts a hex colour; this is --primary. */
const RAZORPAY_THEME = "#18181b";

export default function CartPage() {
  const { user } = useAuth();
  const { items, cartTotal, loading, removeFromCart, updateQuantity } = useCart();
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [itemError, setItemError] = useState("");
  const ids = { phone: useId(), address: useId() };

  // True while the order is being prepared, i.e. until the payment window opens
  // or something fails. Drives the "still working" hint.
  const [preparing, setPreparing] = useState(false);
  const checkoutSlow = useSlowHint(preparing);

  // True from the moment Razorpay reports a payment until the thank-you page
  // replaces this one (or verification fails).
  const [confirming, setConfirming] = useState(false);

  const handleCheckout = async () => {
    setCheckoutError("");
    if (!shippingAddress.trim()) {
      setCheckoutError("Please enter your shipping address.");
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, "").length < 10) {
      setCheckoutError("Please enter a valid phone number.");
      return;
    }

    if (!user) return router.push("/login?redirect=/cart");

    setCheckoutLoading(true);
    setPreparing(true);
    try {
      const created = await createOrder(shippingAddress, phoneNumber);

      // The backend names the key its own secret pairs with, so the two can't
      // drift apart; the build-time key is only for backends that don't send one.
      const keyId = created.keyId || RAZORPAY_KEY_ID;
      if (!keyId) {
        console.error("Checkout: no Razorpay key from the backend and NEXT_PUBLIC_RAZORPAY_KEY_ID is unset");
        setCheckoutError(checkoutErrorMessage(new ApiError("No Razorpay key", 503)));
        setCheckoutLoading(false);
        setPreparing(false);
        return;
      }

      if (!(await loadRazorpay())) {
        setCheckoutError("The payment window couldn't load. Check your connection and try again.");
        setCheckoutLoading(false);
        setPreparing(false);
        return;
      }

      let paid = false;
      openCheckout(
        {
          keyId,
          orderId: created.razorpayOrderId,
          // Razorpay holds the amount on its order; the same figure keeps the
          // window from disagreeing with it if a price changed since the cart loaded.
          amountPaise: created.amount ?? Math.round((created.order?.totalPrice ?? cartTotal) * 100),
          name: "Virtualsphere",
          description: "RFID Order Payment",
          themeColor: RAZORPAY_THEME,
          prefill: { name: user.name, email: user.email, contact: phoneNumber.trim() },
        },
        {
          onPaid: async (payment) => {
            paid = true;
            setCheckoutError("");
            setConfirming(true);
            try {
              await verifyRazorpayPayment(payment);
            } catch (verifyError) {
              console.error("Payment verification failed", verifyError);
              setConfirming(false);
              setCheckoutError("We couldn't verify your payment. Please contact support before trying again.");
              setCheckoutLoading(false);
              return;
            }

            // Google Ads purchase conversion
            if (typeof window !== "undefined" && typeof window.gtag === "function") {
              window.gtag("event", "conversion", {
                send_to: "AW-17705374623/Ty7LCMWB7ZAdEJ-nyvpB",
                value: cartTotal,
                currency: "INR",
                transaction_id: payment.razorpay_order_id,
              });
            }

            // Replace, so Back doesn't return to a cart that's now empty. The
            // thank-you page refreshes the cart; doing it here would flash
            // "Your cart is empty" before the page changes.
            router.replace(orderConfirmationPath(created.order._id));
          },
          // Closing the window used to leave the button stuck on "Processing…".
          // Once a payment has gone through, though, verification is still
          // running and the button must stay busy.
          onDismiss: () => {
            if (!paid) setCheckoutLoading(false);
          },
          onFailed: (reason) => {
            const sentence = reason.trim().replace(/\.?$/, ".");
            setCheckoutError(`Payment failed: ${sentence} You can try again in the payment window.`);
          },
        }
      );
      setPreparing(false);
    } catch (error) {
      console.error("Checkout failed:", error);
      setCheckoutError(checkoutErrorMessage(error));
      setCheckoutLoading(false);
      setPreparing(false);
    }
  };

  const changeQuantity = async (productId: string, quantity: number) => {
    setItemError("");
    try {
      await updateQuantity(productId, quantity);
    } catch {
      setItemError("That quantity couldn't be saved. Please try again.");
    }
  };

  const remove = async (productId: string) => {
    setItemError("");
    try {
      await removeFromCart(productId);
    } catch {
      setItemError("That item couldn't be removed. Please try again.");
    }
  };

  const liveItems = items.filter((item) => item.product);

  return (
    <PageContainer className="pt-10 pb-20 lg:pt-14">
      <SectionHeader as="h1" eyebrow="Checkout" title="Cart" />

      {loading ? (
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-card lg:col-span-5" />
        </div>
      ) : liveItems.length === 0 ? (
        <div className="bg-grid mt-10 flex flex-col items-start rounded-card border border-border bg-surface px-6 py-14 sm:px-10">
          <p className="text-h3">Your cart is empty</p>
          <p className="mt-2 text-small text-muted-foreground">
            {user ? "Add products from the catalog to see them here." : "Sign in to see the items in your cart."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/products">Browse products</ButtonLink>
            {!user && (
              <ButtonLink href="/login?redirect=/cart" variant="outline">
                Sign in
              </ButtonLink>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <section aria-label="Items in your cart" className="lg:col-span-7">
            <ul className="divide-y divide-border border-y border-border">
              {liveItems.map((item) => {
                const product = item.product!;
                const min = Math.max(1, product.minimumQuantity ?? 1);
                return (
                  <li key={product._id} className="flex gap-4 py-6 sm:gap-6">
                    <ProductMedia
                      src={product.images?.[0]}
                      alt=""
                      placeholder=""
                      sizes="128px"
                      className="size-24 shrink-0 rounded-card border border-border sm:size-32"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/products/${product.slug}`} className="text-body font-medium hover:underline">
                            {product.name}
                          </Link>
                          {/[a-z]/i.test(product.sku ?? "") && (
                            <p className="font-mono text-tech text-muted-foreground">{product.sku}</p>
                          )}
                        </div>
                        <p className="shrink-0 text-body font-semibold tabular-nums">
                          {formatCurrency(product.price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <StockBadge stock={product.stock} />
                        <span className="text-small text-muted-foreground tabular-nums">
                          {formatCurrency(product.price)} each{min > 1 && ` · minimum ${min}`}
                        </span>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-4">
                        <QuantityStepper
                          value={item.quantity}
                          min={min}
                          max={Math.max(item.quantity, product.stock)}
                          label={`Quantity, ${product.name}`}
                          onChange={(quantity) => changeQuantity(product._id, quantity)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(product._id)}
                          startIcon={<Trash2 />}
                          aria-label={`Remove ${product.name}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p aria-live="polite" className="mt-3 min-h-6 text-small text-danger">
              {itemError}
            </p>
          </section>

          <section aria-labelledby="summary-heading" className="lg:col-span-5">
            <div className="rounded-card border border-border bg-card p-6 sm:p-8 lg:sticky lg:top-24">
              <h2 id="summary-heading" className="text-h3">
                Order summary
              </h2>

              <dl className="mt-6 border-t border-border text-small">
                <div className="flex justify-between border-b border-border py-3">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(cartTotal)}</dd>
                </div>
                <div className="flex justify-between border-b border-border py-3">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>Calculated at checkout</dd>
                </div>
                <div className="flex items-baseline justify-between py-4">
                  <dt className="text-body font-medium">Order total</dt>
                  <dd className="text-h3 tabular-nums">{formatCurrency(cartTotal)}</dd>
                </div>
              </dl>
              <p className="text-meta text-muted-foreground">{GST_NOTE}</p>

              <div className="mt-8 space-y-5 border-t border-border pt-6">
                <h3 className="text-meta text-muted-foreground uppercase">Shipping details</h3>
                <div className="space-y-2">
                  <Label htmlFor={ids.phone}>Phone number</Label>
                  <Input
                    id={ids.phone}
                    type="tel"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={ids.address}>Delivery address</Label>
                  <Textarea
                    id={ids.address}
                    autoComplete="street-address"
                    placeholder="Street address, city, state and PIN code"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                  />
                </div>

                <p
                  aria-live="polite"
                  className={cn("min-h-5 text-small", checkoutError ? "text-danger" : "text-muted-foreground")}
                >
                  {checkoutError ||
                    (confirming
                      ? "Payment received — confirming your order…"
                      : checkoutSlow
                        ? "Still working — the payment service can take up to a minute to respond the first time."
                        : "")}
                </p>

                <Button
                  size="xl"
                  className="w-full"
                  onClick={handleCheckout}
                  loading={checkoutLoading}
                  loadingText="Processing…"
                  endIcon={<ArrowRight />}
                >
                  Proceed to payment
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
