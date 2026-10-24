import { cache } from "react";
import { connection } from "next/server";
import { fetchProductsResult, fetchProductBySlug, fetchCategoriesResult } from "./api";
import { slugify, stripHtml, truncate } from "./utils";
import { cleanProductName } from "./seo";
import { buildCategoryTree, storefrontCategories, type CategorySummary } from "./categories";
import type { Category, Product } from "@/types";

/**
 * The storefront's read model. Everything here serves public pages only, so it
 * hides products and categories an admin has disabled; the admin panel reads
 * through `./api` directly and sees everything.
 *
 * Reads are memoized per request: `generateMetadata` and the page body both
 * need the same product, and the home page feeds several sections from one
 * product list — without this each of those is a separate round trip to a
 * backend that can take tens of seconds to answer against a cold worker.
 */
const getLiveProductsResult = cache((limit?: number) =>
  fetchProductsResult({ limit, activeOnly: true })
);

const getLiveCategoriesResult = cache(() => fetchCategoriesResult({ status: "true" }));

/**
 * A live product by slug, or null when it doesn't exist or has been disabled.
 * Its name is already cleaned for display (see `cleanProductName`), so the
 * heading, breadcrumb and cart line never show a pasted-in "| Virtualsphere".
 */
export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const product = await fetchProductBySlug(slug);
  if (!product || product.status === false) return null;
  return { ...product, name: cleanProductName(product.name) };
});

/**
 * Categories for the public listing. Like `getProductCards`, a failed fetch
 * drops the route out of prerendering rather than caching an empty page.
 */
export async function getCategories(): Promise<Category[]> {
  const { categories, ok } = await getLiveCategoriesResult();
  if (!ok) await connection();
  return categories;
}

/** Top-level categories with live products, for the home page's pills and cards. */
export async function getStorefrontCategories(): Promise<CategorySummary[]> {
  return storefrontCategories(buildCategoryTree(await getCategories()));
}

/**
 * The shape a product card actually renders.
 *
 * The full /products response is ~95 KB for 30 products, most of it rich-text
 * `description` and full `specifications` that no card renders. Mapping to
 * this shape on the server keeps all of that out of the client payload.
 */
export type ProductSummary = {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  /** Only set when it looks like a real product code (see `displaySku`). */
  sku?: string;
  categoryName: string | null;
  image: string | null;
  excerpt: string;
  /** Minimum order quantity; tags ship in reels of hundreds. */
  minimumQuantity: number;
  /** Up to four headline specifications, in a fixed priority order. */
  keySpecs: KeySpec[];
  /** Overall size from the spec sheet, verbatim ("260 x 260 x 60 mm"). */
  dimensions: string | null;
  /** Pre-lowercased haystack for client-side search. */
  searchText: string;
  createdAt?: string;
};

export type KeySpec = { label: string; value: string };

/**
 * Specifications worth surfacing on a card, most important first, with the
 * short label each is shown under. Names vary by supplier sheet ("Working
 * Frequency", "RF Air Interface"), so each is matched by pattern.
 */
const KEY_SPEC_RULES: [RegExp, string][] = [
  [/frequency/i, "Frequency"],
  [/protocol|air interface/i, "Protocol"],
  [/read(ing)?[\s/]*(write\s*)?(distance|range)|operating distance/i, "Read range"],
  [/^gain$/i, "Gain"],
  // "RF Air Interface" is the radio protocol, not a connection.
  [/^(?!.*\bair\b).*interface/i, "Interface"],
  [/protection|^sealing$/i, "Rating"],
  [/chip/i, "Chip"],
];

function keySpecs(specs: Product["specifications"] | undefined): KeySpec[] {
  const picked: KeySpec[] = [];
  const used = new Set<string>();
  for (const [pattern, label] of KEY_SPEC_RULES) {
    // Each spec row can back only one label.
    const spec = specs?.find((s) => !used.has(s.name) && pattern.test(s.name.trim()) && s.value?.trim());
    if (spec) {
      used.add(spec.name);
      picked.push({ label, value: spec.value.trim() });
    }
    if (picked.length === 4) break;
  }
  return picked;
}

/**
 * Several live products have a stock count typed into the SKU field ("3000",
 * "0"). Showing "SKU 0" on a card reads as broken, so only codes containing a
 * letter are displayed. The raw value still feeds search.
 */
const displaySku = (sku?: string) => (sku && /[a-z]/i.test(sku) ? sku.trim() : undefined);

export function toProductSummary(product: Product): ProductSummary {
  const excerpt = truncate(stripHtml(product.description ?? ""), 200);
  const name = cleanProductName(product.name);

  return {
    _id: product._id,
    name,
    slug: product.slug,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock ?? 0,
    sku: displaySku(product.sku),
    categoryName: product.category?.name ?? null,
    image: product.images?.find(Boolean) ?? null,
    excerpt,
    minimumQuantity: Math.max(1, product.minimumQuantity ?? 1),
    keySpecs: keySpecs(product.specifications),
    dimensions:
      product.specifications
        ?.find((s) => /^(dimensions?|size|overall size)$/i.test(s.name.trim()))
        ?.value.trim() || null,
    searchText: [name, product.sku, product.category?.name, product.productTags, excerpt]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    createdAt: product.createdAt,
  };
}

export type ProductCardsResult = {
  cards: ProductSummary[];
  /**
   * False when the backend didn't answer. Callers must render an error state
   * rather than an empty grid — "the shop has no products" and "we couldn't
   * reach the shop" are different things to tell a visitor.
   */
  ok: boolean;
};

/**
 * Fetch the live catalog in the trimmed card shape.
 *
 * @param limit Rows to request. Omit for the whole catalog — the home page and
 *   /products both do, so they share one cached response.
 */
export async function getProductCards(limit?: number): Promise<ProductCardsResult> {
  const { products, ok } = await getLiveProductsResult(limit);

  if (!ok) {
    // The backend didn't answer. Opt this render out of prerendering so the
    // failure is never frozen into a static page — otherwise a build (or
    // revalidation) that happens to land on one of the backend's stalls would
    // serve an error to everyone until the next revalidation window elapsed.
    // Rendering per request means the very next visitor retries and, once the
    // backend responds, the cache refills.
    await connection();
  }

  return { cards: products.map(toProductSummary), ok };
}

/**
 * Slug, last-modified time and category of every live product, for
 * `generateStaticParams` and the sitemap.
 *
 * Deliberately does *not* go through `getProductCards`: that calls
 * `connection()` when the backend is unreachable, and `generateStaticParams`
 * runs at build time with no incoming request, where `connection()` is an
 * error. A failed fetch here simply means nothing is prebuilt and the product
 * pages render on demand instead — which is the correct fallback.
 */
export async function getProductIndex(): Promise<
  { slug: string; updatedAt?: string; categoryName?: string }[]
> {
  const { products } = await getLiveProductsResult();
  return products
    .filter((product) => typeof product.slug === "string" && product.slug.length > 0)
    .map((product) => ({
      slug: product.slug,
      updatedAt: product.updatedAt,
      categoryName: product.category?.name,
    }));
}

/**
 * The home page's product slots, chosen from the live catalog.
 *
 * Until the admin has a "featured" flag, the selection is deterministic:
 * in-stock RFID hardware (readers, antennas) with a photo and a spec sheet
 * leads, highest price first as a proxy for flagship models, and the showcase
 * takes one product per category so it reads as a range rather than four
 * variants of one reader.
 *
 * The hero is a rotation (`heroSlides`): the pinned products in the order
 * given, then — for any slots they leave empty — the flagship and one product
 * from each other category, so the plate shows the range — a reader, an
 * antenna, a tag — rather than one product. Automatic picks never repeat: filled
 * slides come from what the showcase and rail don't use. Only a product pinned
 * in both the hero and the showcase shows twice.
 */
export const HERO_SLIDE_LIMIT = 5;

export function curateHome(
  cards: ProductSummary[],
  /**
   * Merchandising picks by slug or by product name; any that aren't live and
   * in stock are filled automatically.
   */
  featured: { heroSlides?: string[]; showcase?: string[] } = {}
): {
  heroSlides: ProductSummary[];
  showcase: ProductSummary[];
  rail: ProductSummary[];
} {
  const isHardware = (p: ProductSummary) => /reader|antenna/i.test(p.categoryName ?? "");
  const presentable = (p: ProductSummary) => Boolean(p.image) && p.keySpecs.length >= 2;
  const rank = (p: ProductSummary) =>
    (presentable(p) ? 0 : 2) + (isHardware(p) ? 0 : 1) + (p.stock > 0 ? 0 : 3);

  const ranked = cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rank(a.card) - rank(b.card) || b.card.price - a.card.price || a.index - b.index)
    .map(({ card }) => card);

  // A pin is a slug or, since a slug can be typed freely in the admin panel,
  // the product's name as it reads on the site. Slugs are matched first so a
  // name can never steal another product's pin.
  const inStock = cards.filter((p) => p.stock > 0);
  const pinned = (pin: string) =>
    inStock.find((p) => p.slug === pin) ?? inStock.find((p) => slugify(p.name) === slugify(pin));

  // Pinned slides keep the order they were given in and skip the photo/spec
  // and one-per-category checks: they were chosen by hand.
  const heroSlides: ProductSummary[] = [];
  for (const pin of featured.heroSlides ?? []) {
    const card = pinned(pin);
    if (card && !heroSlides.includes(card) && heroSlides.length < HERO_SLIDE_LIMIT) heroSlides.push(card);
  }
  if (heroSlides.length === 0) {
    const flagship = ranked.find(presentable) || ranked[0];
    if (flagship) heroSlides.push(flagship);
  }
  const taken = new Set(heroSlides.map((p) => p._id));

  // Pinned sheets may repeat a hero slide — the hero is a rotation and these were
  // chosen by hand, so a product pinned in both places shows in both.
  const showcase: ProductSummary[] = [];
  for (const pin of featured.showcase ?? []) {
    const card = pinned(pin);
    if (card && !showcase.includes(card) && showcase.length < 4) {
      showcase.push(card);
      taken.add(card._id);
    }
  }
  const categories = new Set([...heroSlides, ...showcase].map((p) => p.categoryName ?? ""));
  for (const pass of [0, 1]) {
    for (const card of ranked) {
      if (showcase.length === 4) break;
      if (taken.has(card._id) || !card.image) continue;
      if (pass === 0 && categories.has(card.categoryName ?? "")) continue;
      showcase.push(card);
      taken.add(card._id);
      categories.add(card.categoryName ?? "");
    }
  }

  // Fill any empty slots with one slide per category. A rotation of unavailable or
  // photo-less products would show empty plates, so only presentable, in-stock ones qualify.
  const slideCategories = new Set(heroSlides.map((p) => p.categoryName ?? ""));
  for (const card of ranked) {
    if (heroSlides.length === HERO_SLIDE_LIMIT) break;
    if (taken.has(card._id) || !presentable(card) || card.stock <= 0) continue;
    if (slideCategories.has(card.categoryName ?? "")) continue;
    heroSlides.push(card);
    taken.add(card._id);
    slideCategories.add(card.categoryName ?? "");
  }

  const rail = ranked.filter((card) => !taken.has(card._id)).slice(0, 10);

  return { heroSlides, showcase, rail };
}
