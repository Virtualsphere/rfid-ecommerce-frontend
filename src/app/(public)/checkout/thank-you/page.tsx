import type { Metadata } from "next";
import { PageContainer } from "@/components/shared/page-container";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

export const metadata: Metadata = {
  title: "Order confirmed",
  // Personal to one customer. robots.txt also keeps crawlers out of /checkout.
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Where checkout lands once a payment is verified: /checkout/thank-you?order=<order id>. */
export default async function OrderThankYouPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <PageContainer className="pt-10 pb-20 lg:pt-14">
      <OrderConfirmation orderId={first(params.order)} />
    </PageContainer>
  );
}
