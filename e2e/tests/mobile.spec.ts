import { test, expect } from "../fixtures";
import { openPage } from "../support/navigation";

/**
 * Phone layout. Tagged @mobile, so playwright.config.ts runs these in the
 * "mobile" project (a Pixel 7: small screen, touch) and nowhere else.
 */
test.describe("on a phone", { tag: "@mobile" }, () => {
  test("the menu opens, and closes after choosing a page", async ({ page, header }) => {
    await openPage(page, "/");
    await expect(header.menuButton).toHaveAttribute("aria-expanded", "false");

    await header.menuButton.click();

    await expect(header.menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(header.menuButton).toHaveAccessibleName("Close menu");
    await header.navLink("Categories").click();

    await expect(page).toHaveURL("/categories");
    await expect(header.menuButton).toHaveAttribute("aria-expanded", "false");
  });

  test("search lives in the menu", async ({ page, header, catalog }) => {
    await openPage(page, "/");
    await header.menuButton.click();

    await header.searchFor("antenna");

    await expect(page).toHaveURL("/products?search=antenna");
    await expect(catalog.search).toHaveValue("antenna");
  });

  test("catalog filters are tucked behind a button", async ({ catalog }) => {
    await catalog.goto();
    await expect(catalog.inStockOnly).toBeHidden();

    await catalog.filtersToggle.click();

    await expect(catalog.filtersToggle).toHaveAttribute("aria-expanded", "true");
    await expect(catalog.inStockOnly).toBeVisible();
  });
});
