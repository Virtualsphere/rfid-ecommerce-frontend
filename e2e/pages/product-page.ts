import type { Locator, Page } from "@playwright/test";
import { openPage } from "../support/navigation";

/** /products/<slug>: one product, with its photos, price and purchase controls. */
export class ProductPage {
  readonly heading: Locator;
  readonly breadcrumb: Locator;
  readonly quantityLabel: Locator;
  readonly quantity: Locator;
  readonly decrease: Locator;
  readonly increase: Locator;
  readonly addToCart: Locator;
  readonly requestQuote: Locator;
  readonly unitsAvailable: Locator;
  readonly signInPrompt: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole("main");
    // `.first()`: some product descriptions, written in the admin editor,
    // contain an <h1> of their own further down. The product's name comes first.
    this.heading = main.getByRole("heading", { level: 1 }).first();
    this.breadcrumb = main.getByRole("navigation", { name: "Breadcrumb" });
    // "Quantity", or "Quantity — minimum 500" for a product with a minimum order.
    this.quantityLabel = main.getByText(/^Quantity( — minimum \d+)?$/);
    this.quantity = main.getByRole("textbox", { name: /^Quantity/ });
    this.decrease = main.getByRole("button", { name: "Decrease quantity" });
    this.increase = main.getByRole("button", { name: "Increase quantity" });
    // Reads "Out of stock" instead when the product can't be bought.
    this.addToCart = main.getByRole("button", { name: /^(Add to cart|Out of stock)$/ });
    this.requestQuote = main.getByRole("link", { name: /^(Request a quote|Ask about availability)$/ });
    this.unitsAvailable = main.getByText(/^\d+ units? available$/);
    // What a signed-out visitor sees after pressing Add to cart.
    this.signInPrompt = main.getByText("Sign in to add items to your cart.");
  }

  async goto(slug: string) {
    await openPage(this.page, `/products/${slug}`);
  }

  /** Units in stock, from "10 units available"; 0 when none are shown. */
  async stock(): Promise<number> {
    if (!(await this.unitsAvailable.isVisible())) return 0;
    return Number((await this.unitsAvailable.innerText()).match(/^\d+/)![0]);
  }
}
