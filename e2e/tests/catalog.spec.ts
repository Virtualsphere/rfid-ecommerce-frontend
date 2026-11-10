import { test, expect } from "../fixtures";
import { parseCategoryButton } from "../pages/catalog-page";
import { LIVE_PRODUCT } from "../support/test-data";

/**
 * The catalog at /products. Its products come from the live backend, so these
 * tests never hard-code how many products there are or what they cost: they
 * read the page, then check the filters behave consistently with it.
 */

test.beforeEach(async ({ catalog }) => {
  await catalog.goto();
  await expect(catalog.productCards.first()).toBeVisible();
});

test("lists every product, and the count matches the cards", async ({ catalog }) => {
  const count = await catalog.shownCount();

  expect(count).toBeGreaterThan(0);
  await expect(catalog.productCards).toHaveCount(count);
});

test("search narrows the list and is kept in the URL", async ({ page, catalog }) => {
  const total = await catalog.shownCount();

  await catalog.search.fill(LIVE_PRODUCT.searchTerm);

  await expect(catalog.card(new RegExp(LIVE_PRODUCT.namePart))).toBeVisible();
  await expect(page).toHaveURL(`/products?search=${LIVE_PRODUCT.searchTerm}`);
  expect(await catalog.shownCount()).toBeLessThan(total);
});

test("a search with no matches says so, and Clear filters brings everything back", async ({ catalog }) => {
  const total = await catalog.shownCount();

  await catalog.search.fill("zzz-no-such-product-zzz");

  await expect(catalog.noResults).toBeVisible();
  await expect(catalog.productCards).toHaveCount(0);

  await catalog.clearFilters.click();

  await expect(catalog.search).toHaveValue("");
  await expect(catalog.productCards).toHaveCount(total);
});

test("a category filter shows exactly the number of products its button says", async ({ page, catalog }) => {
  // Use the first category that has products, whatever it's called today.
  const categories = (await catalog.categoryButtons().allInnerTexts()).map(parseCategoryButton);
  const { name, count } = categories.find((category) => category.count > 0)!;

  await catalog.categoryButton(name).click();

  await expect(catalog.categoryButton(name)).toHaveAttribute("aria-pressed", "true");
  await expect(catalog.heading).toHaveText(name);
  await expect(catalog.resultCount).toHaveText(`${count} ${count === 1 ? "product" : "products"} in ${name}`);
  await expect(catalog.productCards).toHaveCount(count);
  await expect(page).toHaveURL(/[?&]category=/);
});

test("sorting by price puts the cheapest first", async ({ page, catalog }) => {
  await catalog.sort.selectOption({ label: "Price: low to high" });

  await expect(page).toHaveURL(/sort=price-asc/);
  const prices = await catalog.prices();
  const ascending = [...prices].sort((a, b) => a - b);
  expect(prices).toEqual(ascending);
});

test("sorting by price high to low puts the dearest first", async ({ page, catalog }) => {
  await catalog.sort.selectOption("price-desc");

  await expect(page).toHaveURL(/sort=price-desc/);
  const prices = await catalog.prices();
  expect(prices).toEqual([...prices].sort((a, b) => b - a));
});

test("'In stock only' hides products that are out of stock", async ({ catalog }) => {
  await catalog.inStockOnly.check();

  await expect(catalog.inStockOnly).toBeChecked();
  await expect(catalog.productCards.filter({ hasText: "Out of Stock" })).toHaveCount(0);
});

test("filters survive a page reload", async ({ page, catalog }) => {
  await catalog.search.fill("reader");
  await catalog.sort.selectOption({ label: "Name: A to Z" });
  await expect(page).toHaveURL(/search=reader.*sort=name-asc/);
  const before = await catalog.productNames();

  await page.reload();

  await expect(catalog.search).toHaveValue("reader");
  await expect(catalog.sort).toHaveValue("name-asc");
  expect(await catalog.productNames()).toEqual(before);
});
