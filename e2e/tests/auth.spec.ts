import { test, expect } from "../fixtures";
import { sealSession, SESSION_COOKIE } from "../../src/lib/session-token";
import { E2E_SESSION_SECRET, usingExternalServer } from "../support/env";
import { mockCart, mockLogin } from "../support/mock-api";
import { TEST_CUSTOMER } from "../support/test-data";

/**
 * Signing in, and the pages that need it.
 *
 * Sign-in requests are mocked with page.route(), so no real account is
 * needed and the backend is never asked. That also lets a test pick the
 * answer: a wrong password, or a successful sign-in.
 */

test.describe("signed-out visitors are sent to sign in", () => {
  for (const path of ["/orders", "/profile", "/admin"]) {
    test(`${path} redirects to the login page`, async ({ page, loginPage }) => {
      await page.goto(path);

      // ...remembering where they were going.
      await expect(page).toHaveURL(`/login?redirect=${encodeURIComponent(path)}`);
      await expect(loginPage.heading).toBeVisible();
    });
  }
});

test("the browser won't submit an empty form", async ({ page, loginPage }) => {
  const loginCalls = await mockLogin(page, 200, { user: TEST_CUSTOMER });
  await loginPage.goto();

  await loginPage.submit.click();

  // The fields are `required`, so the browser blocks the submit itself.
  expect(await loginPage.email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(loginCalls).toHaveLength(0);
  await expect(page).toHaveURL("/login");
});

test("a wrong password shows the server's message", async ({ page, loginPage }) => {
  const loginCalls = await mockLogin(page, 401, { message: "Invalid email or password" });
  await loginPage.goto();

  await loginPage.signIn("someone@example.com", "wrong-password");

  await expect(loginPage.error).toHaveText("Invalid email or password");
  await expect(page).toHaveURL("/login");
  // The request carried what was typed.
  expect(loginCalls[0].postDataJSON()).toEqual({ email: "someone@example.com", password: "wrong-password" });
});

test("a server error gets a friendly message", async ({ page, loginPage }) => {
  // A gateway timeout comes back as an HTML page, not JSON.
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 504, contentType: "text/html", body: "<h1>Gateway Timeout</h1>" })
  );
  await loginPage.goto();

  await loginPage.signIn("someone@example.com", "secret");

  await expect(loginPage.error).toHaveText("Login failed: the server took too long to respond. Please try again.");
});

test("signing in returns you to the page that sent you", async ({ page, loginPage, header }) => {
  await mockLogin(page, 200, { user: TEST_CUSTOMER });
  // Once signed in, the page loads the cart; the fake user's is empty.
  await mockCart(page, []);
  await loginPage.goto("/products");

  await loginPage.signIn(TEST_CUSTOMER.email, "correct-password");

  await expect(page).toHaveURL("/products");
  await expect(header.accountMenu).toHaveAccessibleName(`Account: ${TEST_CUSTOMER.name}`);
});

test("the redirect can't send you to another website", async ({ page, loginPage }) => {
  await mockLogin(page, 200, { user: TEST_CUSTOMER });
  // A phishing link: "sign in, then go to evil.example".
  await loginPage.goto("//evil.example/fake-login");

  await loginPage.signIn(TEST_CUSTOMER.email, "correct-password");

  // You land on our home page instead.
  await expect(page).toHaveURL("/");
});

test.describe("with a real session cookie", () => {
  // This minted cookie is encrypted with the secret of the server Playwright
  // starts. Any other server (BASE_URL) has its own secret and would reject it.
  test.skip(usingExternalServer, "Needs the test server started by playwright.config.ts");

  test.beforeEach(async ({ context, page, baseURL }) => {
    // The app's own code seals the cookie, so it's exactly what the server expects.
    const value = await sealSession({ user: TEST_CUSTOMER, token: "not-a-real-backend-token" }, E2E_SESSION_SECRET);
    await context.addCookies([{ name: SESSION_COOKIE, value, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    // Signed in, the page loads the cart. Answer that here, so the made-up
    // token is never sent to the real backend.
    await mockCart(page, []);
  });

  test("the header shows who is signed in", async ({ page, header }) => {
    await page.goto("/");

    await expect(header.accountMenu).toBeVisible();
    await expect(header.signInLink).toHaveCount(0);
  });

  test("a customer can't open the admin panel", async ({ page }) => {
    await page.goto("/admin");

    // The server sends non-admins back to the home page.
    await expect(page).toHaveURL("/");
  });
});
