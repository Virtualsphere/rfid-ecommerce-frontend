import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProductBySlug } from "./api";
import { curateHome, getProductBySlug, HERO_SLIDE_LIMIT, toProductSummary, type ProductSummary } from "./products";
import type { Product } from "@/types";

vi.mock("./api", () => ({
  fetchProductBySlug: vi.fn(),
  fetchProductsResult: vi.fn(),
  fetchCategoriesResult: vi.fn(),
}));

let seq = 0;
function card(overrides: Partial<ProductSummary> & { categoryName: string }): ProductSummary {
  seq += 1;
  return {
    _id: `id-${seq}`,
    name: `Product ${seq}`,
    slug: `product-${seq}`,
    price: 1000,
    stock: 5,
    image: `/uploads/p${seq}.png`,
    excerpt: "",
    minimumQuantity: 1,
    keySpecs: [
      { label: "Frequency", value: "860-960 MHz" },
      { label: "Protocol", value: "EPC Gen2" },
    ],
    dimensions: null,
    searchText: "",
    ...overrides,
  };
}

describe("curateHome hero slides", () => {
  const catalog = () => [
    card({ categoryName: "Handheld Reader", price: 51000, slug: "handheld" }),
    card({ categoryName: "Handheld Reader", price: 48000, slug: "handheld-2" }),
    card({ categoryName: "UHF Antenna", price: 7000, slug: "antenna" }),
    card({ categoryName: "Desktop Reader", price: 20000, slug: "desktop" }),
    card({ categoryName: "Four Port Reader", price: 45000, slug: "four-port" }),
    card({ categoryName: "Integrated Reader", price: 30000, slug: "integrated" }),
    card({ categoryName: "Laundry Tags", price: 60, slug: "tags" }),
    card({ categoryName: "Pendrive Reader", price: 1500, slug: "pendrive" }),
  ];

  it("leads with the flagship and takes one product per category", () => {
    const { heroSlides } = curateHome(catalog());
    const categories = heroSlides.map((p) => p.categoryName);

    expect(heroSlides[0].slug).toBe("handheld");
    expect(new Set(categories).size).toBe(categories.length);
    expect(heroSlides.length).toBeLessThanOrEqual(HERO_SLIDE_LIMIT);
    expect(heroSlides.length).toBeGreaterThan(1);
  });

  it("shows the pinned slides in the order given, even from one category", () => {
    const { heroSlides } = curateHome(catalog(), {
      heroSlides: ["antenna", "handheld-2", "handheld", "desktop", "tags"],
    });
    expect(heroSlides.map((p) => p.slug)).toEqual(["antenna", "handheld-2", "handheld", "desktop", "tags"]);
  });

  it("fills slots left by pinned slides that aren't live or in stock", () => {
    const cards = catalog();
    cards.push(card({ categoryName: "Sold Out Reader", stock: 0, slug: "sold-out" }));
    const { heroSlides } = curateHome(cards, { heroSlides: ["antenna", "sold-out", "missing", "antenna"] });

    expect(heroSlides[0].slug).toBe("antenna");
    expect(heroSlides.map((p) => p.slug)).not.toContain("sold-out");
    expect(new Set(heroSlides.map((p) => p._id)).size).toBe(heroSlides.length);
    expect(heroSlides.length).toBeGreaterThan(1);
  });

  it("never pins more than the slide limit", () => {
    const cards = catalog();
    const { heroSlides } = curateHome(cards, { heroSlides: cards.map((p) => p.slug) });
    expect(heroSlides).toHaveLength(HERO_SLIDE_LIMIT);
  });

  it("never repeats a product from the showcase or the rail", () => {
    const { heroSlides, showcase, rail } = curateHome(catalog());
    const ids = [...heroSlides, ...showcase, ...rail].map((p) => p._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lets a pinned showcase sheet repeat a pinned hero slide, but never an automatic pick", () => {
    const { heroSlides, showcase, rail } = curateHome(catalog(), {
      heroSlides: ["handheld", "integrated"],
      showcase: ["handheld", "four-port", "handheld", "missing"],
    });

    expect(showcase.slice(0, 2).map((p) => p.slug)).toEqual(["handheld", "four-port"]);
    expect(showcase).toHaveLength(4);
    expect(new Set(showcase.map((p) => p._id)).size).toBe(showcase.length);
    expect(heroSlides.slice(0, 2).map((p) => p.slug)).toEqual(["handheld", "integrated"]);
    // Everything beyond the pins is filled without repeating anything already shown.
    const autoHero = heroSlides.slice(2).map((p) => p._id);
    const autoShowcase = showcase.slice(2).map((p) => p._id);
    expect(autoHero.filter((id) => autoShowcase.includes(id))).toEqual([]);
    expect(rail.filter((p) => showcase.includes(p) || heroSlides.includes(p))).toEqual([]);
  });

  it("pins a product by its name when its slug isn't known", () => {
    const cards = catalog();
    cards.push(
      card({
        categoryName: "UHF Desktop Reader",
        name: "Virtualsphere UDT-W3 UHF RFID Table Top Reader – Impinj E310, 500+ Tags/Sec, USB Type-C",
        slug: "udt-w3",
      })
    );
    const { showcase } = curateHome(cards, {
      showcase: ["handheld", "Virtualsphere UDT-W3 UHF RFID Table Top Reader – Impinj E310, 500+ Tags/Sec, USB Type-C"],
    });
    expect(showcase.slice(0, 2).map((p) => p.slug)).toEqual(["handheld", "udt-w3"]);
  });

  it("matches a pin's slug before any product's name", () => {
    const cards = catalog();
    cards.unshift(card({ categoryName: "Handheld Reader", name: "Desktop" }));
    expect(curateHome(cards, { showcase: ["desktop"] }).showcase[0].slug).toBe("desktop");
  });

  it("skips products that are out of stock, photo-less or thinly specified", () => {
    // Four pricier readers fill the showcase, which is picked before the rotation.
    const showcaseFill = ["A", "B", "C", "D"].map((n) =>
      card({ categoryName: `Fill ${n} Reader`, price: 90000 })
    );
    const { heroSlides } = curateHome([
      ...showcaseFill,
      card({ categoryName: "Handheld Reader", price: 99000, slug: "handheld" }),
      card({ categoryName: "Sold Out Reader", stock: 0, price: 40000 }),
      card({ categoryName: "Photo-less Reader", image: null, price: 39000 }),
      card({ categoryName: "Thin Reader", keySpecs: [], price: 38000 }),
      card({ categoryName: "Good Antenna", price: 7000, slug: "good" }),
    ]);

    expect(heroSlides.map((p) => p.slug)).toEqual(["handheld", "good"]);
  });

  it("is a single slide when only one product qualifies", () => {
    const { heroSlides } = curateHome([card({ categoryName: "Handheld Reader" })]);
    expect(heroSlides).toHaveLength(1);
  });

  it("is empty for an empty catalog", () => {
    expect(curateHome([]).heroSlides).toEqual([]);
  });
});

/** A full backend product; only the fields these tests look at are meaningful. */
const product = (overrides: Partial<Product> = {}): Product => ({
  _id: "p1",
  name: "UHR2 UHF RFID Handheld Reader",
  slug: "uhr2-uhf-rfid-handheld-reader",
  description: "<p>An Android handheld reader.</p>",
  model: "UHR2",
  sku: "UHR2",
  price: 50000,
  stock: 5,
  minimumQuantity: 1,
  subtractStock: true,
  status: true,
  sortOrder: 0,
  category: { _id: "c1", name: "RFID Handheld Reader" },
  images: [],
  specifications: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

describe("toProductSummary", () => {
  it("shows the cleaned name on cards", () => {
    expect(toProductSummary(product({ name: "UDR-W101 RFID Desktop Reader & Writer | Virtualsphere" })).name).toBe(
      "UDR-W101 RFID Desktop Reader & Writer"
    );
    expect(toProductSummary(product({ name: "VSL-F2 UHF RFID 4 Port Reader | Impinj E710" })).name).toBe(
      "VSL-F2 UHF RFID 4 Port Reader – Impinj E710"
    );
  });

  it("searches on the cleaned name", () => {
    const { searchText } = toProductSummary(product({ name: "UHR2 UHF RFID Handheld Reader | Virtualsphere" }));
    expect(searchText).toContain("uhr2 uhf rfid handheld reader");
    expect(searchText).not.toContain("|");
  });
});

describe("getProductBySlug", () => {
  beforeEach(() => vi.mocked(fetchProductBySlug).mockReset());

  it("returns the product with its name cleaned for the heading", async () => {
    vi.mocked(fetchProductBySlug).mockResolvedValue(
      product({ name: "UDT9R RFID Jewellery Tray Reader | Virtualsphere", sku: "UDT9R" })
    );

    const found = await getProductBySlug("udt9r-rfid-jewellery-tray-reader");

    expect(found?.name).toBe("UDT9R RFID Jewellery Tray Reader");
    expect(found?.sku).toBe("UDT9R");
  });

  it("hides a product an admin has disabled", async () => {
    vi.mocked(fetchProductBySlug).mockResolvedValue(product({ status: false }));
    expect(await getProductBySlug("disabled")).toBeNull();
  });

  it("is null when the backend has no such product", async () => {
    vi.mocked(fetchProductBySlug).mockResolvedValue(null);
    expect(await getProductBySlug("nope")).toBeNull();
  });
});
