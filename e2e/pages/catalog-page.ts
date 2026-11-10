import type { Locator, Page } from "@playwright/test";
import { openPage } from "../support/navigation";

/** /products: the full catalog with search, category filters and sorting. */
export class CatalogPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly sort: Locator;
  readonly filtersToggle: Locator;
  readonly filters: Locator;
  readonly inStockOnly: Locator;
  readonly resultCount: Locator;
  readonly productCards: Locator;
  readonly noResults: Locator;
  readonly clearFilters: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole("main");
    this.heading = main.getByRole("heading", { level: 1 });
    this.search = main.getByRole("searchbox", { name: "Search products" });
    this.sort = main.getByRole("combobox", { name: "Sort" });
    // `exact`, or "Clear filters" would match too: names match substrings by default.
    this.filtersToggle = main.getByRole("button", { name: "Filters", exact: true });
    this.filters = main.getByRole("complementary", { name: "Filters" });
    this.inStockOnly = main.getByRole("checkbox", { name: "In stock only" });
    // "32 products", or "8 products in RFID Tags" when a category is chosen.
    this.resultCount = main.getByText(/^\d+ products?\b/);
    this.productCards = main.getByRole("article");
    this.noResults = main.getByText("No products match");
    // There can be two (toolbar and empty state); either does the same.
    this.clearFilters = main.getByRole("button", { name: "Clear filters" }).first();
  }

  async goto(query = "") {
    await openPage(this.page, `/products${query}`);
  }

  /** A category's filter button. Its name ends in the product count: "RFID Tags 8". */
  categoryButton(name: string) {
    return this.filters.getByRole("button", { name: new RegExp(`^${escapeRegExp(name)} \\d+$`) });
  }

  /** Every category filter except "All products". */
  categoryButtons() {
    return this.filters.getByRole("button").filter({ hasNotText: "All products" });
  }

  /** The card for a product, found by (part of) its name. */
  card(name: string | RegExp) {
    return this.productCards.filter({ has: this.page.getByRole("heading", { name }) });
  }

  /** The number in "32 products". */
  async shownCount(): Promise<number> {
    return Number((await this.resultCount.innerText()).match(/^\d+/)![0]);
  }

  /** Each card's price in rupees, in the order shown. "₹1,78,000" → 178000. */
  async prices(): Promise<number[]> {
    const texts = await this.productCards.allInnerTexts();
    return texts.map((text) => {
      // The first rupee amount on a card is its price (a sale card follows it with "was ₹…").
      const match = text.match(/₹\s?([\d,]+(?:\.\d+)?)/);
      if (!match) throw new Error(`No price on card:\n${text}`);
      return Number(match[1].replaceAll(",", ""));
    });
  }

  async productNames(): Promise<string[]> {
    return this.productCards.getByRole("heading").allInnerTexts();
  }
}

/** A category's filter button name, parsed: "RFID Tags 8" → { name: "RFID Tags", count: 8 }. */
export function parseCategoryButton(label: string) {
  const match = label.replace(/\s+/g, " ").trim().match(/^(.*) (\d+)$/);
  if (!match) throw new Error(`Unexpected category button: "${label}"`);
  return { name: match[1], count: Number(match[2]) };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
