import { test, expect } from "../fixtures";
import { mockCart, mockSignedIn } from "../support/mock-api";
import { FAKE_READER, FAKE_TAG, NEW_DELHI_PINCODE, SAMPLE_CART } from "../support/test-data";

/**
 * The cart. A cart belongs to a signed-in account, so these tests fake both:
 * mockSignedIn() answers the "who am I?" check and mockCart() plays the cart
 * backend. The products in it are made up (see test-data.ts).
 */

test("a signed-out visitor is asked to sign in", async ({ page, cartPage }) => {
  await cartPage.goto();

  await expect(cartPage.emptyMessage).toBeVisible();
  await expect(page.getByText("Sign in to see the items in your cart.")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?redirect=/cart"
  );
});

test("a signed-in customer with nothing in the cart is sent to browse", async ({ page, cartPage }) => {
  await mockSignedIn(page);
  await mockCart(page, []);
  await cartPage.goto();

  await expect(cartPage.emptyMessage).toBeVisible();
  await expect(page.getByText("Add products from the catalog to see them here.")).toBeVisible();
});

test.describe("with items in the cart", () => {
  test.beforeEach(async ({ page, cartPage }) => {
    await mockSignedIn(page);
    await mockCart(page, SAMPLE_CART);
    await cartPage.goto();
    await expect(cartPage.items).toHaveCount(2);
  });

  test("lists each item with its line total", async ({ cartPage }) => {
    await expect(cartPage.item(FAKE_READER.name)).toContainText("₹10,000");
    await expect(cartPage.item(FAKE_TAG.name)).toContainText("₹2,500");
    await expect(cartPage.item(FAKE_TAG.name)).toContainText("₹5 each · minimum 500");
  });

  test("adds 18% GST to the subtotal", async ({ cartPage }) => {
    await expect(cartPage.summaryValue("Subtotal")).toHaveText("₹12,500");
    await expect(cartPage.summaryValue("GST")).toHaveText("18%");
    await expect(cartPage.summaryValue("Order total")).toHaveText("₹14,750");
  });

  test("the header's cart link counts the units", async ({ header }) => {
    // 1 reader + 500 tags.
    await expect(header.cartLink).toHaveAccessibleName("Cart, 501 items");
  });

  test("removing an item updates the totals", async ({ page, cartPage }) => {
    await cartPage.item(FAKE_TAG.name).getByRole("button", { name: `Remove ${FAKE_TAG.name}` }).click();

    await expect(cartPage.items).toHaveCount(1);
    await expect(cartPage.summaryValue("Subtotal")).toHaveText("₹10,000");
    await expect(cartPage.summaryValue("Order total")).toHaveText("₹11,800");
    await expect(page.getByRole("main")).not.toContainText(FAKE_TAG.name);
  });

  test("increasing a quantity updates the totals", async ({ cartPage }) => {
    const reader = cartPage.item(FAKE_READER.name);

    await reader.getByRole("button", { name: "Increase quantity" }).click();

    await expect(reader.getByRole("textbox", { name: `Quantity, ${FAKE_READER.name}` })).toHaveValue("2");
    await expect(cartPage.summaryValue("Subtotal")).toHaveText("₹22,500");
    await expect(cartPage.summaryValue("Order total")).toHaveText("₹26,550");
  });

  test("a bulk item can't go below its minimum order", async ({ cartPage }) => {
    const tags = cartPage.item(FAKE_TAG.name);

    await expect(tags.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });

  test("checkout needs a delivery address first", async ({ page, cartPage }) => {
    await cartPage.proceedToPayment.click();

    await expect(cartPage.summary.getByText("Please complete your delivery address.")).toBeVisible();
    // Still on the cart: no order was started.
    await expect(page).toHaveURL("/cart");
  });

  test("a PIN code fills in the city and state", async ({ page, cartPage }) => {
    await page.route(`**/api/pincode/${NEW_DELHI_PINCODE.pincode}`, (route) =>
      route.fulfill({ json: NEW_DELHI_PINCODE })
    );

    await cartPage.pincode.fill(NEW_DELHI_PINCODE.pincode);

    await expect(cartPage.pincode).toHaveAccessibleDescription("New Delhi, Delhi");
    await expect(cartPage.city).toHaveValue("New Delhi");
    await expect(cartPage.state).toHaveValue("Delhi");
    await expect(cartPage.locality).toBeEnabled();
  });

  test("an unknown PIN code is flagged", async ({ page, cartPage }) => {
    await page.route("**/api/pincode/999999", (route) =>
      route.fulfill({ status: 404, json: { message: "No post office has this PIN code." } })
    );

    await cartPage.pincode.fill("999999");

    await expect(cartPage.pincode).toHaveAccessibleDescription("We couldn't find this PIN code. Please check it.");
  });
});
