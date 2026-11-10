import type { Page, Request } from "@playwright/test";
import { TEST_CUSTOMER, type CartLine, type TestUser } from "./test-data";

/**
 * Network mocks: answers for the browser's calls to this app's own /api
 * routes, so a test controls what the page sees without a real backend.
 *
 * These only intercept requests the *browser* makes. Pages rendered on the
 * server (the product catalog, for one) still fetch real data, which is why
 * the catalog tests read the live catalog.
 */

/** Pretend `user` is signed in, as far as the page's JavaScript can tell. */
export async function mockSignedIn(page: Page, user: TestUser = TEST_CUSTOMER) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user } }));
}

/**
 * A fake cart backend that remembers changes, like the real one: removing an
 * item or changing a quantity changes what the next GET returns.
 *
 * Returns the requests it received, so a test can check what the page sent.
 */
export async function mockCart(page: Page, initial: CartLine[]) {
  let items: CartLine[] = structuredClone(initial);
  const requests: { action: string; body: { productId: string; quantity?: number } }[] = [];

  await page.route("**/api/backend/cart", (route) => route.fulfill({ json: { items } }));

  await page.route("**/api/backend/cart/*", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const body = route.request().postDataJSON();
    requests.push({ action, body });

    if (action === "remove") {
      items = items.filter((line) => line.product._id !== body.productId);
    } else if (action === "update") {
      items = items.map((line) =>
        line.product._id === body.productId ? { ...line, quantity: body.quantity } : line
      );
    }
    await route.fulfill({ json: { items } });
  });

  return { requests };
}

/** Answer sign-in attempts with `status` and `body` instead of asking the backend. */
export async function mockLogin(page: Page, status: number, body: unknown) {
  const calls: Request[] = [];
  await page.route("**/api/auth/login", (route) => {
    calls.push(route.request());
    return route.fulfill({ status, json: body });
  });
  return calls;
}

/** Answer contact-form submissions with `status` and `body`. */
export async function mockEnquiry(page: Page, status: number, body: unknown) {
  const calls: Request[] = [];
  await page.route("**/api/backend/enquiries", (route) => {
    calls.push(route.request());
    return route.fulfill({ status, json: body });
  });
  return calls;
}
