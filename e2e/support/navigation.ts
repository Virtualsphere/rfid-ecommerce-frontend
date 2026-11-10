import type { Page } from "@playwright/test";

/**
 * page.goto(), then wait until the page's JavaScript is in charge.
 *
 * Next.js sends finished HTML first, so buttons and fields appear before
 * React has attached what they do ("hydration"). A test that clicks in that
 * gap presses a button that does nothing yet, and fails now and then: a
 * flaky test. Every page asks "who is signed in?" (/api/auth/session) as soon
 * as React runs, so that answer arriving is a reliable "ready" signal.
 *
 * Waiting for a real signal like this beats `page.waitForTimeout(2000)`:
 * it's as fast as the page allows, and never too short on a slow day.
 */
export async function openPage(page: Page, path: string) {
  const ready = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/session");
  await page.goto(path);
  await ready;
}
