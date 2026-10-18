import { Eyebrow } from "@/components/shared/section-header";
import { PageContainer } from "@/components/shared/page-container";
import { CUSTOMER_LOGOS, HEADLINE_STATS } from "@/content/claims";
import { cn } from "@/lib/utils";

/**
 * Proof: customer logos and headline figures, laid out as a hairline spec
 * strip rather than a row of floating logos. Content comes from
 * content/claims.ts, which is flagged for verification — each half hides
 * itself when its list is emptied there.
 *
 * Hovering a logo spotlights it: the logo scales up and regains its colour
 * while the rest of the section blurs back (`logo-dimmed` in globals.css).
 */
const DIMMABLE =
  "transition-[filter,opacity] duration-300 ease-standard logo-dimmed:opacity-50 logo-dimmed:blur-[3px] motion-reduce:transition-none";

export function ProofSection() {
  if (CUSTOMER_LOGOS.length === 0 && HEADLINE_STATS.length === 0) return null;

  return (
    <section aria-labelledby="proof-title" data-logo-spotlight className="border-y border-border">
      <PageContainer className="grid grid-cols-1 gap-10 py-16 lg:grid-cols-12 lg:gap-12 lg:py-20">
        <div className={cn("lg:col-span-3", DIMMABLE)}>
          <Eyebrow>Customers</Eyebrow>
          <h2 id="proof-title" className="mt-4 text-h3 text-balance">
            Trusted by teams at
          </h2>
        </div>

        <div className="lg:col-span-9">
          {CUSTOMER_LOGOS.length > 0 && (
            <ul className="grid grid-cols-2 border-t border-l border-border sm:grid-cols-3 lg:grid-cols-5">
              {CUSTOMER_LOGOS.map((logo) => (
                <li
                  key={logo.name}
                  data-logo
                  className="group/logo flex h-24 items-center justify-center border-r border-b border-border px-6"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- mixed local and remote logo files */}
                  <img
                    src={logo.src}
                    alt={logo.name}
                    width={logo.width}
                    height={logo.height}
                    loading="lazy"
                    className="max-h-10 w-auto max-w-full object-contain opacity-70 grayscale transition-[scale,filter,opacity] duration-300 ease-emphasized group-hover/logo:scale-115 group-hover/logo:opacity-100 group-hover/logo:grayscale-0 logo-dimmed:opacity-40 logo-dimmed:blur-[3px] motion-reduce:transition-none"
                  />
                </li>
              ))}
            </ul>
          )}

          {HEADLINE_STATS.length > 0 && (
            <dl className={cn("mt-10 grid grid-cols-2 gap-y-8 sm:grid-cols-4", DIMMABLE)}>
              {HEADLINE_STATS.map((stat) => (
                <div key={stat.label} className="border-l border-border pl-4">
                  <dt className="text-meta text-muted-foreground uppercase">{stat.label}</dt>
                  <dd className="mt-2 text-h2 tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </PageContainer>
    </section>
  );
}
