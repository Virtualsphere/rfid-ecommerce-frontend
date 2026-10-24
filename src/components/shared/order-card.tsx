import Link from "next/link";
import { ProductMedia } from "@/components/shared/product-image";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { orderNumber } from "@/lib/orders";
import { formatCurrency, formatDate } from "@/lib/utils";

/** The fields of GET /orders/myorders that the storefront renders. */
export type CustomerOrder = {
  _id: string;
  createdAt: string;
  /** What was paid, GST included. */
  totalPrice: number;
  /** The GST in `totalPrice`. Missing on orders placed before GST was added. */
  gstAmount?: number;
  status: string;
  shippingAddress?: string;
  phoneNumber?: string;
  items: {
    _id: string;
    quantity: number;
    priceAtPurchase: number;
    product: {
      _id: string;
      name: string;
      slug: string;
      images?: string[];
      category?: { name: string } | null;
    } | null;
  }[];
};

/**
 * A past order: header facts, status, and its line items. Used by /orders,
 * /profile and the checkout thank-you page, which hides "Buy again".
 */
export function OrderCard({ order, buyAgain = true }: { order: CustomerOrder; buyAgain?: boolean }) {
  return (
    <article className="overflow-hidden rounded-card border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <Fact label="Placed">{formatDate(order.createdAt)}</Fact>
          <Fact label="Total">
            <span className="tabular-nums">{formatCurrency(order.totalPrice)}</span>
            {order.gstAmount ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {" "}
                incl. {formatCurrency(order.gstAmount)} GST
              </span>
            ) : null}
          </Fact>
          <Fact label="Order">
            <span className="font-mono">{orderNumber(order._id)}</span>
          </Fact>
        </dl>
        <OrderStatusBadge status={order.status} size="md" />
      </header>

      <ul className="divide-y divide-border">
        {order.items.map((item) => {
          const product = item.product;
          if (!product) {
            return (
              <li key={item._id} className="px-5 py-5 text-small text-muted-foreground sm:px-6">
                This product is no longer available.
              </li>
            );
          }
          return (
            <li key={item._id} className="flex flex-wrap items-center gap-4 px-5 py-5 sm:flex-nowrap sm:px-6">
              <ProductMedia
                src={product.images?.[0]}
                alt=""
                placeholder=""
                sizes="80px"
                className="size-20 shrink-0 rounded-control border border-border"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/products/${product.slug}`} className="text-body font-medium hover:underline">
                  {product.name}
                </Link>
                {product.category?.name && (
                  <p className="text-meta text-muted-foreground uppercase">{product.category.name}</p>
                )}
                <p className="mt-1 text-small text-muted-foreground tabular-nums">
                  {formatCurrency(item.priceAtPurchase)} × {item.quantity}
                </p>
              </div>
              {buyAgain && (
                <ButtonLink href={`/products/${product.slug}`} variant="outline" size="sm">
                  Buy again
                </ButtonLink>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-meta text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-small font-medium">{children}</dd>
    </div>
  );
}
