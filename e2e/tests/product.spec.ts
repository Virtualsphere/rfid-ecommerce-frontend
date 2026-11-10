import { test, expect } from "../fixtures";
import { LIVE_PRODUCT } from "../support/test-data";

/** A product page: details, the quantity stepper, and what Add to cart does when signed out. */

test("opening a product from the catalog shows its page", async ({ page, catalog, productPage }) => {
  await catalog.goto();
  const firstCard = catalog.productCards.first();
  const name = await firstCard.getByRole("heading").innerText();

  await firstCard.getByRole("link").click();

  await expect(page).toHaveURL(/\/products\/[^/?]+$/);
  await expect(productPage.heading).toHaveText(name);
  // The breadcrumb ends with the product itself.
  await expect(productPage.breadcrumb.getByRole("listitem").last()).toHaveText(name);
});

test.describe("quantity", () => {
  test.beforeEach(async ({ productPage }) => {
    await productPage.goto(LIVE_PRODUCT.slug);
    // These tests need something to buy. If the product sells out, skip
    // rather than fail: that's the catalog changing, not a bug.
    test.skip((await productPage.stock()) < 2, "The product doesn't have 2 units in stock right now");
  });

  test("starts at 1 and can't go below it", async ({ productPage }) => {
    await expect(productPage.quantity).toHaveValue("1");
    await expect(productPage.decrease).toBeDisabled();
  });

  test("+ and − change it by one", async ({ productPage }) => {
    await productPage.increase.click();
    await expect(productPage.quantity).toHaveValue("2");
    await expect(productPage.decrease).toBeEnabled();

    await productPage.decrease.click();
    await expect(productPage.quantity).toHaveValue("1");
  });

  test("a typed amount above the stock is capped at the stock", async ({ productPage }) => {
    const stock = await productPage.stock();

    await productPage.quantity.fill("99999");
    await productPage.quantity.press("Enter");

    await expect(productPage.quantity).toHaveValue(String(stock));
    await expect(productPage.increase).toBeDisabled();
  });

  test("letters can't be typed into it", async ({ productPage }) => {
    await productPage.quantity.fill("");
    await productPage.quantity.pressSequentially("3abc");

    await expect(productPage.quantity).toHaveValue("3");
  });
});

test("a product sold in bulk starts at its minimum order", async ({ catalog, productPage }) => {
  await catalog.goto();
  // Cards show an "MOQ 500" badge when there's a minimum order quantity.
  const bulkCard = catalog.productCards.filter({ hasText: /MOQ \d+/ }).first();
  test.skip((await bulkCard.count()) === 0, "No product in the catalog has a minimum order right now");
  const moq = (await bulkCard.innerText()).match(/MOQ (\d+)/)![1];

  await bulkCard.getByRole("link").click();

  await expect(productPage.quantityLabel).toHaveText(`Quantity — minimum ${moq}`);
  await expect(productPage.quantity).toHaveValue(moq);
  await expect(productPage.decrease).toBeDisabled();
});

test("Add to cart asks a signed-out visitor to sign in", async ({ page, productPage }) => {
  await productPage.goto(LIVE_PRODUCT.slug);
  test.skip((await productPage.stock()) === 0, "The product is out of stock right now");

  await productPage.addToCart.click();

  await expect(productPage.signInPrompt).toBeVisible();
  // ...with a link that brings them back to this product afterwards.
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    `/login?redirect=${encodeURIComponent(`/products/${LIVE_PRODUCT.slug}`)}`
  );
});

test("Request a quote pre-fills the contact form", async ({ page, productPage, contactPage }) => {
  await productPage.goto(LIVE_PRODUCT.slug);
  const name = await productPage.heading.innerText();

  await productPage.requestQuote.click();

  await expect(page).toHaveURL(/\/contact\?topic=quote/);
  await expect(contactPage.subject).toHaveValue("quote");
  await expect(contactPage.message).toHaveValue(new RegExp(`^I'd like a quote for 1 × ${escapeRegExp(name)}`));
});

test("an unknown product shows the not-found page and is kept out of search engines", async ({ page }) => {
  await page.goto("/products/this-product-does-not-exist");

  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  // The page carries the layout's "index, follow" tag as well; search engines
  // obey the strictest one, so a single "noindex" is enough.
  await expect(page.locator('meta[name="robots"][content~="noindex"]').first()).toBeAttached();
});

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
