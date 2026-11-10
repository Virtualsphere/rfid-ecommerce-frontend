import { defineConfig, devices } from "@playwright/test";
import { E2E_SESSION_SECRET } from "./e2e/support/env";

/**
 * Playwright end-to-end tests. See e2e/README.md for how to run them.
 *
 * By default Playwright builds the app and serves it on port 3100, a separate
 * port from `npm run dev` (3000), so the tests never depend on how your own
 * dev server happens to be configured. Set BASE_URL to test any other running
 * copy instead, e.g. BASE_URL=https://indiarfidshop.com.
 */
const PORT = 3100;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e/tests",

  // The catalog comes from a live backend that can be slow to wake up, so
  // allow more time than Playwright's defaults (30s per test, 5s per assertion).
  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: true,
  // A stray `test.only` would silently skip the rest of the suite on CI.
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // Evidence for failures: a trace (timeline, DOM snapshots, network) when a
    // test is retried, a screenshot and a video when one fails.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // The site animates sections in with GSAP, but skips that for visitors
    // who prefer reduced motion. Tests do too: nothing moves while clicked.
    reducedMotion: "reduce",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },

  projects: [
    {
      name: "desktop",
      // 1440px wide: the header's search box only shows from 1280px up.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      grep: /@mobile/,
    },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: BASE_URL,
        // Locally, reuse a server that's already up on the port (UI mode keeps
        // one running between runs). On CI, always start fresh.
        reuseExistingServer: !CI,
        timeout: 300_000,
        stdout: "ignore",
        stderr: "pipe",
        env: { SESSION_SECRET: E2E_SESSION_SECRET },
      },
});
