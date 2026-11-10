import { test, expect } from "../fixtures";
import { openPage } from "../support/navigation";

/**
 * Smoke tests: the main pages open and the header gets you around.
 * Start here — these use the basics: goto, locators, clicks, assertions.
 */

test("home page loads with its title and headline", async ({ page }) => {
  await openPage(page, "/");

  await expect(page).toHaveTitle("RFID Readers, Tags & Antennas in India | Virtualsphere");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Enterprise RFID hardware");
});

// One test per menu item, generated from a table: a "data-driven" test.
const NAV = [
  { label: "Products", path: "/products", heading: "Products" },
  { label: "Categories", path: "/categories", heading: "Product categories" },
  { label: "About", path: "/about", heading: "Virtualsphere Technologies Pvt Ltd" },
  { label: "Contact", path: "/contact", heading: "Contact Virtualsphere" },
];

for (const item of NAV) {
  test(`header link "${item.label}" opens ${item.path}`, async ({ page, header }) => {
    await openPage(page, "/");

    await header.navLink(item.label).click();

    await expect(page).toHaveURL(item.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.heading);
    // The current page's link is marked for screen readers (and underlined).
    await expect(header.navLink(item.label)).toHaveAttribute("aria-current", "page");
  });
}

test("the logo goes back to the home page", async ({ page, header }) => {
  await openPage(page, "/about");

  await header.homeLink.click();

  await expect(page).toHaveURL("/");
});

test("searching from the header opens the filtered catalog", async ({ page, header, catalog }) => {
  await openPage(page, "/");

  await header.searchFor("reader");

  await expect(page).toHaveURL("/products?search=reader");
  // The catalog's own search box picks the term up.
  await expect(catalog.search).toHaveValue("reader");
});

test("Support opens the resource centre in a new tab", async ({ page, context, header }) => {
  // The resource centre is another website. Stub it, so this test checks our
  // link without depending on that site being up.
  await context.route("https://resource.indiarfidshop.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Resource centre (stub)</h1>" })
  );
  await openPage(page, "/");

  // Start waiting for the new tab *before* clicking, or the event can be missed.
  const newTab = context.waitForEvent("page");
  await header.mainNav.getByRole("link", { name: /^Support/ }).click();
  const supportTab = await newTab;

  await expect(supportTab).toHaveURL("https://resource.indiarfidshop.com/");
  // The original tab stays where it was.
  await expect(page).toHaveURL("/");
});

test("an unknown page shows the 404 page", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");

  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
});
