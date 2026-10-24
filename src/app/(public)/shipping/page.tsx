import type { Metadata } from "next";
import Link from "next/link";
import { PolicyFacts, PolicyList, PolicyPage, PolicySection } from "@/components/shared/policy-page";
import { POLICIES_UPDATED, RETURNS, SHIPPING } from "@/content/policies";
import { SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

const PATH = "/shipping";

export const metadata: Metadata = pageMetadata({
  title: "Shipping & Delivery Policy",
  description:
    "How and when Virtualsphere Technologies Private Limited processes, ships and delivers your RFID order.",
  path: PATH,
});

const linkClass = "text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

export default function ShippingPage() {
  return (
    <PolicyPage title="Shipping & Delivery Policy" path={PATH} updated={POLICIES_UPDATED}>
      <p>
        This policy explains how <strong>VIRTUALSPHERE TECHNOLOGIES PRIVATE LIMITED</strong> (&quot;we&quot;,
        &quot;us&quot;, &quot;our&quot;) processes, ships and delivers orders placed through this website. If
        something arrives damaged or is not what you ordered, see our{" "}
        <Link href="/returns" className={linkClass}>
          Return &amp; Refund Policy
        </Link>
        .
      </p>

      <PolicyFacts
        items={[
          { label: "We ship to", value: SHIPPING.coverage },
          { label: "Order processing", value: SHIPPING.processingTime },
          ...SHIPPING.transit.map(({ destination, time }) => ({ label: destination, value: time })),
        ]}
      />

      <PolicySection title="Order processing">
        <p>
          We begin processing an order once your payment is confirmed. Orders are normally packed and handed to the
          courier within {SHIPPING.processingTime}. Orders placed on Sundays and public holidays are processed on the
          next business day.
        </p>
        <p>
          If an item is not in stock, or an order needs configuring before dispatch, we will contact you with a revised
          date before we ship.
        </p>
      </PolicySection>

      <PolicySection title="Delivery areas and times">
        <p>
          We deliver to {SHIPPING.coverage}. The transit times in the table above start from the day the parcel is
          dispatched, not the day you order.
        </p>
        <p>
          These are estimates. Delays can be caused by courier handling, weather, strikes, local restrictions or
          incomplete addresses, and are outside our control. A delay does not entitle you to cancel an order that has
          already been dispatched, but please contact us if your parcel is more than a few days late and we will
          chase the courier for you.
        </p>
      </PolicySection>

      <PolicySection title="Shipping charges">
        <p>
          Any shipping charge that applies to your order is confirmed before dispatch and is shown on your invoice. Prices on
          this website exclude 18% GST, which is added when you pay, and do not include shipping unless the product page
          says so.
        </p>
      </PolicySection>

      <PolicySection title="Tracking your order">
        <p>
          When your order is dispatched we send you the courier name and tracking number by email, SMS or WhatsApp.
          You can also check the status of your order on the{" "}
          <Link href="/orders" className={linkClass}>
            Orders
          </Link>{" "}
          page when signed in.
        </p>
      </PolicySection>

      <PolicySection title="Delivery address and receiving your parcel">
        <PolicyList>
          <li>
            Please give a complete address with the PIN code and a phone number that will be answered, as the courier
            will call before delivery. We are not responsible for delays or non-delivery caused by an incorrect or
            incomplete address.
          </li>
          <li>
            If a parcel is returned to us because nobody could receive it, we will contact you to arrange another
            delivery. The cost of the second delivery may be charged to you.
          </li>
          <li>
            Please check the outer packaging when you receive the parcel. If it is damaged or has been opened, note it
            with the courier, and record a video of opening it.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="Damaged or missing items">
        <p>
          Tell us within {RETURNS.damageReportHours} hours if the parcel arrives damaged or an item is missing. Send your order number with
          photos or an unboxing video, and we will sort it out under our{" "}
          <Link href="/returns" className={linkClass}>
            Return &amp; Refund Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="Contact us about a delivery">
        <address className="space-y-1 not-italic">
          <p>
            Email:{" "}
            <a href={`mailto:${SITE_CONFIG.email}`} className={`${linkClass} break-all`}>
              {SITE_CONFIG.email}
            </a>
          </p>
          <p>
            Phone:{" "}
            <a href={`tel:${SITE_CONFIG.phone}`} className={`${linkClass} tabular-nums`}>
              {SITE_CONFIG.phone}
            </a>{" "}
            or{" "}
            <a href={`tel:${SITE_CONFIG.phoneSecondary}`} className={`${linkClass} tabular-nums`}>
              {SITE_CONFIG.phoneSecondary}
            </a>
          </p>
        </address>
      </PolicySection>
    </PolicyPage>
  );
}
