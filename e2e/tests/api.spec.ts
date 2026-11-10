import { test, expect } from "@playwright/test";

/**
 * API tests: no browser at all. The `request` fixture sends HTTP requests
 * straight to the app, which is quicker than driving a page and the way to
 * check status codes and headers.
 *
 * Only requests that the app answers itself are sent here. Nothing reaches
 * the shop's real backend.
 */

test("the session endpoint says nobody is signed in without a cookie", async ({ request }) => {
  const response = await request.get("/api/auth/session");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ user: null });
  // A user's session must never be cached and shown to someone else.
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("sign-in without a password is refused before reaching the backend", async ({ request }) => {
  const response = await request.post("/api/auth/login", { data: { email: "someone@example.com" } });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ message: "Email and password are required" });
});

test("sign-in from another website is blocked (CSRF protection)", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    headers: { Origin: "https://evil.example" },
    data: { email: "someone@example.com", password: "secret" },
  });

  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ message: "Cross-site request blocked" });
});

for (const pin of ["abc", "12345", "0110001"]) {
  test(`PIN code lookup rejects "${pin}"`, async ({ request }) => {
    const response = await request.get(`/api/pincode/${pin}`);

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("A PIN code is six digits.");
  });
}

test("robots.txt keeps private pages out of search engines", async ({ request }) => {
  const response = await request.get("/robots.txt");
  const body = await response.text();

  expect(response.ok()).toBe(true);
  for (const path of ["/admin", "/api/", "/cart", "/login"]) {
    expect(body).toContain(`Disallow: ${path}`);
  }
  expect(body).toMatch(/^Sitemap: https:\/\/.+\/sitemap\.xml$/m);
});

test("the sitemap lists the product pages", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  const xml = await response.text();

  expect(response.headers()["content-type"]).toContain("xml");
  const productUrls = xml.match(/<loc>[^<]+\/products\/[^<]+<\/loc>/g) ?? [];
  expect(productUrls.length).toBeGreaterThan(0);
  // No private pages in it.
  expect(xml).not.toMatch(/<loc>[^<]+\/(admin|cart|login)/);
});
