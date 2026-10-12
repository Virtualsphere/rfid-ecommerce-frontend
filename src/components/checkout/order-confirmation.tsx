"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { fetchMyOrders } from "@/lib/api";
import { orderConfirmationPath, orderNumber } from "@/lib/orders";
import { SITE_CONFIG, whatsappUrl } from "@/lib/constants";
import { SHIPPING } from "@/content/policies";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eyebrow } from "@/components/shared/section-header";
import { OrderCard, type CustomerOrder } from "@/components/shared/order-card";

type Lookup =
  | { status: "loading" }
  | { status: "found"; order: CustomerOrder }
  | { status: "missing" }
  | { status: "failed" };

/**
 * What a customer sees once their payment is verified: thanks, the order they
 * just placed, where it's going and what happens next.
 *
 * The backend has no single-order endpoint, so the order is looked up in the
 * customer's own order list. That keeps the page working after a refresh, and
 * it can only ever show the signed-in customer's own orders.
 */
export function OrderConfirmation({ orderId }: { orderId?: string }) {
  const { user, loading: authLoading } = useAuth();
  const { refreshCart } = useCart();
  const router = useRouter();
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const back = orderId ? orderConfirmationPath(orderId) : "/orders";
      router.replace(`/login?redirect=${encodeURIComponent(back)}`);
      return;
    }
    if (!orderId) return;

    let current = true;
    fetchMyOrders()
      .then((orders: CustomerOrder[]) => {
        const order = orders.find((o) => o._id === orderId);
        if (current) setLookup(order ? { status: "found", order } : { status: "missing" });
      })
      .catch((error) => {
        console.error("Failed to load the order", error);
        if (current) setLookup({ status: "failed" });
      });
    return () => {
      current = false;
    };
  }, [user, authLoading, orderId, router]);

  // Payment emptied the cart on the server; this brings the header's count down to match.
  useEffect(() => {
    if (user) refreshCart();
  }, [user, refreshCart]);

  const view: Lookup = orderId ? lookup : { status: "missing" };

  if (view.status === "missing") {
    return (
      <div className="max-w-2xl">
        <Eyebrow className="mb-4">Order confirmation</Eyebrow>
        <h1 className="text-h1 text-balance">We couldn&apos;t find that order</h1>
        <p className="mt-4 max-w-xl text-lead text-pretty text-muted-foreground">
          It isn&apos;t one of the orders on your account. If you&apos;ve just paid, check My orders, or contact us
          and we&apos;ll look it up for you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/orders">View my orders</ButtonLink>
          <ButtonLink href="/contact" variant="outline">
            Contact us
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl">
        <CheckCircle2 aria-hidden className="size-10 text-success" />
        <Eyebrow className="mt-6 mb-4">Order confirmed</Eyebrow>
        <h1 className="text-h1 text-balance">Thank you for your order!</h1>
        <p className="mt-4 max-w-xl text-lead text-pretty text-muted-foreground">
          Your payment was successful and we&apos;ve received your order. We&apos;ll keep its status up to date in
          My orders.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/orders" endIcon={<ArrowRight />}>
            View my orders
          </ButtonLink>
          <ButtonLink href="/products" variant="outline">
            Continue shopping
          </ButtonLink>
        </div>
      </div>

      {view.status === "loading" && (
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <Skeleton className="h-56 rounded-card lg:col-span-7" />
          <Skeleton className="h-56 rounded-card lg:col-span-5" />
        </div>
      )}

      {view.status === "failed" && (
        <p className="mt-12 text-small text-muted-foreground">
          We couldn&apos;t load your order&apos;s details just now. You&apos;ll find them in My orders.
        </p>
      )}

      {view.status === "found" && <OrderDetails order={view.order} />}
    </>
  );
}

function OrderDetails({ order }: { order: CustomerOrder }) {
  const number = orderNumber(order._id);

  return (
    <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      <section aria-label="Your order" className="lg:col-span-7">
        <OrderCard order={order} buyAgain={false} />
      </section>

      <aside aria-label="Delivery and next steps" className="lg:col-span-5">
        <div className="rounded-card border border-border bg-card p-6 sm:p-8">
          <dl className="space-y-5 text-small">
            {order.shippingAddress && (
              <Detail label="Delivering to">
                <span className="whitespace-pre-line">{order.shippingAddress}</span>
              </Detail>
            )}
            {order.phoneNumber && (
              <Detail label="Phone">
                <span className="tabular-nums">{order.phoneNumber}</span>
              </Detail>
            )}
            <Detail label="What happens next">
              We&apos;ll pack your order and hand it to our courier within {SHIPPING.processingTime}. Its status
              changes to Shipped when it&apos;s on its way.
            </Detail>
            <Detail label="Questions">
              Call{" "}
              <a href={`tel:${SITE_CONFIG.phone}`} className="tabular-nums underline underline-offset-4">
                {SITE_CONFIG.phone}
              </a>{" "}
              or{" "}
              <a
                href={whatsappUrl(`Hi Virtualsphere, I have a question about my order ${number}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                message us on WhatsApp
              </a>
              , quoting order <span className="font-mono">{number}</span>.
            </Detail>
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-5 last:border-b-0 last:pb-0">
      <dt className="text-meta text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
