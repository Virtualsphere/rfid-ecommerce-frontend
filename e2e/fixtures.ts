import { test as base, expect } from "@playwright/test";
import { SiteHeader } from "./pages/site-header";
import { CatalogPage } from "./pages/catalog-page";
import { ProductPage } from "./pages/product-page";
import { LoginPage } from "./pages/login-page";
import { ContactPage } from "./pages/contact-page";
import { CartPage } from "./pages/cart-page";

/**
 * The `test` every spec imports, instead of Playwright's own.
 *
 * It adds two things through fixtures:
 *  - page objects, so a test asks for `{ catalog }` instead of building one;
 *  - two automatic fixtures (`auto: true`) that run for every test without
 *    being asked for: one blocks analytics and chat scripts, the other stops
 *    a test from ever writing to the real backend.
 */
type Fixtures = {
  header: SiteHeader;
  catalog: CatalogPage;
  productPage: ProductPage;
  loginPage: LoginPage;
  contactPage: ContactPage;
  cartPage: CartPage;
  blockThirdParties: void;
  forbidRealWrites: void;
};

/** Analytics, ads, live chat and the map: slow, and test visits shouldn't be counted. */
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|tawk\.to|maps\.google\.com/;

export const test = base.extend<Fixtures>({
  header: async ({ page }, use) => use(new SiteHeader(page)),
  catalog: async ({ page }, use) => use(new CatalogPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),

  blockThirdParties: [
    async ({ context }, use) => {
      await context.route(THIRD_PARTY, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],

  /**
   * Safety net. The app's backend is the live shop, so a test that forgot a
   * mock could send a real enquiry or change a real cart. Every browser
   * request that would change something (anything but GET) is refused here
   * unless the test mocked it.
   *
   * This works because routes added with page.route() in a test take
   * precedence over this context-wide one.
   */
  forbidRealWrites: [
    async ({ context }, use) => {
      await context.route(/\/api\/(backend|auth)\//, async (route) => {
        const request = route.request();
        if (request.method() === "GET") return route.fallback();
        await route.fulfill({
          status: 418,
          json: { message: `Blocked by the e2e safety net: ${request.method()} ${request.url()} wasn't mocked.` },
        });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
