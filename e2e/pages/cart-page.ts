import type { Locator, Page } from "@playwright/test";
import { openPage } from "../support/navigation";

/** /cart: the items, the delivery address form and the order summary. */
export class CartPage {
  readonly heading: Locator;
  readonly emptyMessage: Locator;
  readonly items: Locator;
  readonly summary: Locator;
  readonly proceedToPayment: Locator;
  /**
   * The PIN code field. The line under it ("New Delhi, Delhi" once the code
   * is found) is its accessible description, so assert on it with
   * `toHaveAccessibleDescription`.
   */
  readonly pincode: Locator;
  readonly locality: Locator;
  readonly city: Locator;
  readonly state: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole("main");
    this.heading = main.getByRole("heading", { name: "Cart", level: 1 });
    this.emptyMessage = main.getByText("Your cart is empty");
    this.items = main.getByRole("region", { name: "Items in your cart" }).getByRole("listitem");
    this.summary = main.getByRole("region", { name: "Order summary" });
    this.proceedToPayment = main.getByRole("button", { name: "Proceed to payment" });
    this.pincode = main.getByRole("textbox", { name: "PIN code" });
    this.locality = main.getByRole("combobox", { name: "Locality" });
    this.city = main.getByRole("textbox", { name: "City / District", exact: true });
    this.state = main.getByRole("textbox", { name: "State", exact: true });
  }

  async goto() {
    await openPage(this.page, "/cart");
  }

  /** One line of the cart, found by the product's name. */
  item(productName: string) {
    return this.items.filter({ hasText: productName });
  }

  /** The value of an order summary row: "Subtotal", "GST" or "Order total". */
  summaryValue(label: "Subtotal" | "GST" | "Order total") {
    return this.summary.locator("dl > div").filter({ hasText: label }).getByRole("definition");
  }
}
