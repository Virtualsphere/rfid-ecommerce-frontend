import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, ShieldCheck, Phone } from "lucide-react";
import { getProductBySlug, getProductIndex, toProductSummary } from "@/lib/products";
import { sanitizeProductHtml } from "@/lib/sanitize";
import { pageMetadata, stripBrand } from "@/lib/seo";
import { formatCurrency, getServerUrl, slugify, stripHtml, truncate } from "@/lib/utils";
import { GST_NOTE, SITE_CONFIG, whatsappUrl } from "@/lib/constants";
import type { Product } from "@/types";
import { ImageGallery } from "@/components/products/image-gallery";
import { PurchaseForm } from "@/components/products/purchase-form";
import { StockBadge } from "@/components/shared/status-badge";
import { PageContainer } from "@/components/shared/page-container";

type Props = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;

/**
 * Prebuild the catalog's product pages so a visitor arriving from a search
 * engine gets HTML immediately instead of waiting on a live backend call.
 * Slugs not listed here are still rendered on demand and then cached.
 */
export async function generateStaticParams() {
  const products = await getProductIndex();
  return products.map(({ slug }) => ({ slug }));
}

/**
 * Page titles that override the product's own Meta Title, by lowercase slug.
 * Written without the brand: the layout's template adds it. While a product is
 * listed here, editing its Meta Title in the admin panel changes nothing;
 * delete its entry to hand the title back to the admin.
 */
const PRODUCT_TITLES: Record<string, string> = {
  "desktop-barcode-printer": "Desktop Barcode Label Printer",
  "hrd-13": "HRD 13 HF 13.56MHz USB Desktop RFID Reader",
  "lrp-70-pendrive-reader": "LRP 70 125KHz LF RFID USB Pendrive Reader",
  ua9: "UA9 9dBi Circular UHF RFID Antenna, IP67",
  uca3: "UCA3 3dBi Ceramic UHF RFID Patch Antenna",
  "udr-w101-uhf-rfid-desktop-reader-writer": "UDR-W101 UHF RFID Desktop Reader & Writer",
  "udt9r-rfid-jewellery-tray-reader": "UDT9R RFID Jewellery Tray Reader, Bluetooth",
  "uhr2-uhf-rfid-handheld-reader": "UHR2 Android UHF RFID Handheld Reader, 20m",
  "vst-9662-rfid-uhf-inlay-higgs-3": "VST-9662 UHF RFID Inlay, Alien Higgs-3",
  "pbr3-bluetooth-uhf-rfid-portable-reader": "PBR3 Bluetooth UHF RFID Portable Reader",
  ua12: "UA12 12dBi Circular UHF RFID Antenna",
  "uhr-5": "UHR 5 UHF RFID Handheld Reader with NFC",
  "udr-102": "UDR 102 UHF RFID Desktop Reader & Writer",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product Not Found" };
  }

  // Fall back to name/description if custom SEO fields are empty. The layout's
  // title template adds the brand, so strip it from a stored title that
  // already carries one. The description is rich-text HTML, so strip it —
  // otherwise search results show raw "<p><strong>…" markup as the snippet.
  const title = stripBrand(
    PRODUCT_TITLES[product.slug.toLowerCase()] || product.metaTitle?.trim() || product.name
  );
  const description = product.metaDescription || truncate(stripHtml(product.description ?? ""), 160);
  const image = product.images?.find(Boolean);

  return pageMetadata({
    title,
    description,
    path: `/products/${encodeURIComponent(product.slug)}`,
    images: image ? [getServerUrl(image)] : [],
  });
}

/**
 * Product page. The purchase decision comes first: on desktop the gallery and
 * the purchase panel sit side by side; on a phone the order is photo → name →
 * price and GST → stock → quantity → Add to cart → Request a quote. The long
 * description and the full specification table come after, never before.
 */
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const summary = toProductSummary(product);
  // Resolve image paths against the backend origin, dropping repeats: a
  // filename collision in the old upload handler left some products listing the
  // same file twice, which rendered as duplicate thumbnails.
  const images = Array.from(new Set((product.images ?? []).filter(Boolean).map((img) => getServerUrl(img))));
  const onSale = product.compareAtPrice !== undefined && product.compareAtPrice > product.price;
  const details = detailRows(product, summary.sku);
  const description = sanitizeProductHtml(product.description);

  return (
    <>
      <PageContainer as="nav" aria-label="Breadcrumb" className="pt-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-small text-muted-foreground">
          <Crumb href="/">Home</Crumb>
          <Crumb href="/products">Products</Crumb>
          {product.category && (
            <Crumb href={`/products?category=${slugify(product.category.name)}`}>{product.category.name}</Crumb>
          )}
          <li aria-current="page" className="truncate text-foreground">
            {product.name}
          </li>
        </ol>
      </PageContainer>

      <PageContainer className="grid grid-cols-1 gap-10 pt-6 pb-16 lg:grid-cols-12 lg:gap-12 lg:pb-24">
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-24">
            <ImageGallery images={images} productName={product.name} />
          </div>
        </div>

        {/* Purchase panel */}
        <div className="lg:col-span-5">
          <p className="flex flex-wrap items-center gap-2 text-meta text-muted-foreground uppercase">
            {product.category?.name}
            {summary.sku && (
              <>
                {product.category && <span aria-hidden className="h-3 w-px bg-border-strong" />}
                <span className="font-mono tracking-normal">
                  <span className="sr-only">SKU </span>
                  {summary.sku}
                </span>
              </>
            )}
          </p>
          <h1 className="mt-3 text-h1 text-balance">{product.name}</h1>
          {summary.excerpt && (
            <p className="mt-4 line-clamp-3 text-body text-pretty text-muted-foreground">{summary.excerpt}</p>
          )}

          <div className="mt-8 border-t border-border pt-6">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-h2 tabular-nums">{formatCurrency(product.price)}</span>
              {onSale && (
                <s className="text-body text-muted-foreground tabular-nums">
                  <span className="sr-only">was </span>
                  {formatCurrency(product.compareAtPrice!)}
                </s>
              )}
            </p>
            <p className="mt-1 text-small text-muted-foreground">
              {GST_NOTE}
              {summary.minimumQuantity > 1 && <> · per unit, minimum order {summary.minimumQuantity}</>}
            </p>
            <p className="mt-4 flex flex-wrap items-center gap-3 text-small text-muted-foreground">
              <StockBadge stock={product.stock} size="md" />
              {product.stock > 0 && (
                <span className="tabular-nums">
                  {product.stock} {product.stock === 1 ? "unit" : "units"} available
                </span>
              )}
            </p>
          </div>

          <div className="mt-6">
            <PurchaseForm
              productId={product._id}
              slug={product.slug}
              name={product.name}
              sku={summary.sku}
              stock={product.stock}
              minimumQuantity={summary.minimumQuantity}
            />
          </div>

          {summary.keySpecs.length > 0 && (
            <dl className="mt-8 border-t border-border">
              {summary.keySpecs.map((spec) => (
                <div key={spec.label} className="flex items-baseline justify-between gap-6 border-b border-border py-3">
                  <dt className="shrink-0 text-meta text-muted-foreground uppercase">{spec.label}</dt>
                  <dd className="text-right font-mono text-tech">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <ul className="mt-8 space-y-3 text-small text-muted-foreground">
            <li className="flex items-center gap-3">
              <ShieldCheck aria-hidden className="size-4 shrink-0 text-foreground" />
              Secure payment via Razorpay
            </li>
            <li className="flex items-center gap-3">
              <Phone aria-hidden className="size-4 shrink-0 text-foreground" />
              <span>
                Questions about this product?{" "}
                <a href={`tel:${SITE_CONFIG.phone}`} className="text-foreground tabular-nums hover:underline">
                  {SITE_CONFIG.phone}
                </a>
                {" · "}
                <a
                  href={whatsappUrl(`Hi Virtualsphere, I have a question about ${product.name}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline"
                >
                  WhatsApp
                </a>
              </span>
            </li>
            {/* Readers ship with an SDK; antennas don't have one to request. */}
            {/reader/i.test(product.category?.name ?? "") && (
              <li className="flex items-center gap-3">
                <Download aria-hidden className="size-4 shrink-0 text-foreground" />
                <span>
                  Need the SDK or drivers?{" "}
                  <a
                    href={SITE_CONFIG.resourcesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline"
                  >
                    Request the reader SDK
                  </a>
                </span>
              </li>
            )}
          </ul>
        </div>
      </PageContainer>

      {(description || details.length > 0) && (
        <section aria-label="Product details" className="border-t border-border bg-surface">
          <PageContainer className="grid grid-cols-1 gap-14 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
            {description && (
              <div className="lg:col-span-7">
                <h2 className="text-h2">Overview</h2>
                <div
                  className="prose mt-6 max-w-none prose-headings:tracking-tight prose-img:rounded-card prose-img:border prose-img:border-border prose-table:text-small"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              </div>
            )}

            {details.length > 0 && (
              <div className={description ? "lg:col-span-5" : "lg:col-span-8"}>
                <h2 className="text-h2">Specifications</h2>
                {details.map((group) => (
                  <div key={group.title} className="mt-8">
                    <h3 className="text-meta text-muted-foreground uppercase">{group.title}</h3>
                    <dl className="mt-3 border-t border-border">
                      {group.rows.map((row) => (
                        <div
                          key={`${group.title}-${row.label}`}
                          className="grid grid-cols-[minmax(7rem,2fr)_3fr] gap-4 border-b border-border py-3"
                        >
                          <dt className="text-small text-muted-foreground">{row.label}</dt>
                          <dd className="font-mono text-tech break-words">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </PageContainer>
        </section>
      )}
    </>
  );
}

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Link href={href} className="transition-colors hover:text-foreground">
        {children}
      </Link>
      <ChevronRight aria-hidden className="size-3.5" />
    </li>
  );
}

/** The spec sheet plus the product's identifiers and logistics data, as grouped rows. */
function detailRows(product: Product, sku: string | undefined) {
  const technical = (product.specifications ?? [])
    .filter((s) => s.name?.trim() && s.value?.trim())
    .map((s) => ({ label: s.name.trim(), value: s.value.trim() }));

  const dims = product.dimensions;
  const identifiers = [
    { label: "Model", value: product.model },
    { label: "SKU", value: sku },
    { label: "MPN", value: product.mpn },
    { label: "UPC", value: product.upc },
    { label: "EAN", value: product.ean },
    { label: "JAN", value: product.jan },
    { label: "ISBN", value: product.isbn },
    {
      label: "Weight",
      value: (product.weight ?? 0) > 0 ? `${product.weight} ${product.weightClass ?? ""}`.trim() : undefined,
    },
    {
      label: "Package (L × W × H)",
      value:
        dims && (dims.length || dims.width || dims.height)
          ? `${dims.length || 0} × ${dims.width || 0} × ${dims.height || 0} ${product.lengthClass ?? ""}`.trim()
          : undefined,
    },
    {
      label: "Minimum order",
      value: (product.minimumQuantity ?? 1) > 1 ? `${product.minimumQuantity} units` : undefined,
    },
    { label: "Tags", value: product.productTags },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value?.toString().trim()));

  return [
    { title: "Technical data", rows: technical },
    { title: "Product details", rows: identifiers },
  ].filter((group) => group.rows.length > 0);
}
