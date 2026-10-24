import type { Metadata } from "next";
import { ArrowUpRight, Download } from "lucide-react";
import { SITE_CONFIG, whatsappUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SUPPORT_HOURS } from "@/content/claims";
import { PageContainer } from "@/components/shared/page-container";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { SectionHeader } from "@/components/shared/section-header";
import { ContactForm } from "@/components/contact/contact-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us – RFID Quotes & Support",
  description:
    "Get in touch with Virtualsphere — request a quote, ask a technical question, or discuss your RFID deployment needs.",
  path: "/contact",
});

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <>
      <PageContainer className="pt-10 pb-16 lg:pt-14 lg:pb-24">
        <SectionHeader
          as="h1"
          eyebrow="Get in touch"
          title="Contact Virtualsphere"
          description="Have a question about our products, need a custom quote, or want to discuss a deployment? We're here to help."
        />

        <div className="mt-12 grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <ContactForm
              topic={first(params.topic)}
              product={first(params.product)}
              quantity={first(params.qty)}
            />
          </div>

          <aside className="lg:col-span-5">
            <h2 className="text-h3">Contact Us</h2>
            <dl className="mt-6 border-t border-border">
              <Row label="Address">
                <address className="not-italic">
                  <a href={SITE_CONFIG.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {SITE_CONFIG.address.street}
                    <br />
                    {SITE_CONFIG.address.city}, {SITE_CONFIG.address.state} {SITE_CONFIG.address.zip}
                    <br />
                    {SITE_CONFIG.address.country}
                  </a>
                </address>
              </Row>
              <Row label="Mobile">
                <a href={`tel:${SITE_CONFIG.phone}`} className="tabular-nums hover:underline">
                  {SITE_CONFIG.phone}
                </a>
                <br />
                <a href={`tel:${SITE_CONFIG.phoneSecondary}`} className="tabular-nums hover:underline">
                  {SITE_CONFIG.phoneSecondary}
                </a>
              </Row>
              <Row label="WhatsApp">
                <a
                  href={whatsappUrl("Hi Virtualsphere, I have a question about your RFID products.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <WhatsAppIcon className="size-4" />
                  <span className="tabular-nums">{SITE_CONFIG.whatsapp}</span>
                </a>
              </Row>
              <Row label="Email">
                <a href={`mailto:${SITE_CONFIG.email}`} className="break-all hover:underline">
                  {SITE_CONFIG.email}
                </a>
              </Row>
              <Row label="Reader SDK">
                <p className="text-muted-foreground">Download reader SDKs, drivers and datasheets.</p>
                <a
                  href={SITE_CONFIG.resourcesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
                >
                  <Download aria-hidden />
                  Resource centre
                  <ArrowUpRight aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Row>
              {SUPPORT_HOURS.map((slot) => (
                <Row key={slot.days} label={slot.days}>
                  <span className="tabular-nums">{slot.hours}</span>
                </Row>
              ))}
            </dl>

            <div className="mt-10 rounded-card border border-border bg-surface p-6">
              <h3 className="text-body font-semibold">Enterprise accounts</h3>
              <p className="mt-2 text-small text-muted-foreground">
                Need volume pricing, custom configurations, or dedicated support? Our enterprise team can help.
              </p>
              <a
                href={`mailto:${SITE_CONFIG.email}`}
                className="mt-4 inline-block text-small font-medium underline decoration-border-strong underline-offset-[6px] hover:decoration-foreground"
              >
                Contact enterprise sales
              </a>
            </div>
          </aside>
        </div>
      </PageContainer>

      <div className="border-t border-border">
        <iframe
          src={`https://maps.google.com/maps?q=${SITE_CONFIG.mapCoordinates}&hl=en&z=16&output=embed`}
          className="block h-112 w-full grayscale"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Map: Virtualsphere Technologies, Sector 10, Noida"
        />
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-4 text-small">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
