# End-to-end tests (Playwright)

Browser tests for the storefront. They open real pages in Chromium and
click, type and check what a customer would. They're also a small project
for learning QA automation with Playwright and TypeScript.

## Running them

The first time only, download the browser:

```bash
npx playwright install chromium
```

Then:

| Command | What it does |
| --- | --- |
| `npm run test:e2e` | Run every test, headless, and print the results |
| `npm run test:e2e:ui` | **Best for learning.** Opens Playwright's UI: pick a test, watch it run step by step, see the page at each step |
| `npm run test:e2e:headed` | Run with the browser window visible |
| `npm run test:e2e:report` | Open the HTML report from the last run (screenshots and videos of failures) |
| `npx playwright test cart` | Run only the files whose name contains "cart" |
| `npx playwright test -g "GST"` | Run only tests whose title contains "GST" |
| `npx playwright test --debug` | Step through a test one action at a time |
| `npx playwright codegen localhost:3000` | With `npm run dev` running: click around and Playwright writes the code for you |

Playwright builds the app and serves it on **port 3100**, apart from
`npm run dev` on 3000, with its own `SESSION_SECRET`. The build takes about a
minute. UI mode keeps that server running between runs, so later runs start
straight away.

To test another copy of the site instead, set `BASE_URL`, e.g. in PowerShell:
`$env:BASE_URL="https://indiarfidshop.com"; npx playwright test`.

## How it's organised

```
playwright.config.ts   where tests live, browsers, timeouts, the test server
e2e/
  fixtures.ts          the `test` every spec imports: page objects + safety nets
  pages/               page objects: one class per page, holding its locators
  support/
    navigation.ts      openPage(): goto + wait until the page is ready
    mock-api.ts        fake answers for the app's API (sign-in, cart, contact)
    test-data.ts       the made-up users and products the mocks serve
    env.ts             the test server's session secret
  tests/               the tests themselves
```

### Reading order

Each spec file adds a few new ideas. Read them in this order:

1. **navigation.spec.ts**: `page.goto`, locators (`getByRole`), clicks,
   `expect(...)` assertions, data-driven tests (a `for` loop over a table),
   handling a new tab.
2. **catalog.spec.ts**: `beforeEach`, the page object model, filtering
   locators (`filter({ hasText })`), reading values off the page and checking
   them (sorting), testing against live data without hard-coding it.
3. **product.spec.ts**: `test.describe` groups, `test.skip` when the data
   doesn't allow a test, boundary values (minimum and maximum quantity).
4. **contact.spec.ts**: form validation, **network mocking** with
   `page.route()`, checking the request the page *sent*, simulating a server
   failure.
5. **auth.spec.ts**: server redirects, mocked sign-in, a security check (open
   redirect), and setting a real session cookie with `context.addCookies()`.
6. **cart.spec.ts**: a stateful fake backend (`mockCart`), so a whole
   signed-in cart works with no account at all; money calculations with GST.
7. **api.spec.ts**: API testing with the `request` fixture, with no browser:
   status codes, headers, JSON bodies.
8. **mobile.spec.ts**: a phone viewport, and tags (`@mobile`) to pick which
   project runs a test.

## Ideas worth knowing

**Locate elements the way a user would.** `getByRole("button", { name: "Add to cart" })`
finds what a person (or screen reader) sees. A CSS class like `.btn-primary`
can change any day without the page changing for users. If a role locator
can't find something, that's often an accessibility bug in the page.

**Web-first assertions wait for you.** `await expect(locator).toHaveText(...)`
retries for up to 15 seconds (set in the config) until it passes. Never add
`page.waitForTimeout()`. Wait for something specific instead (see `openPage()`
in `support/navigation.ts`).

**Strict mode.** A locator that matches two elements fails rather than
guessing. That's how this suite found product pages with two `<h1>` headings.
Make the locator more specific, or use `.first()` when the duplicate is
expected.

**Never touch real data.** The backend is the live shop. Anything that would
create or change something (an enquiry, a cart, a sign-in) is mocked. As a
safety net, `fixtures.ts` blocks any write a test forgot to mock, and a test
in `contact.spec.ts` proves the net works.

**Mocks only reach the browser.** `page.route()` intercepts requests the
*browser* makes. Pages the server renders (the product catalog) fetch real
data, which is why those tests read the live catalog rather than fake data.

**Arrange, act, assert.** Most tests are three blocks separated by blank
lines: set things up, do one thing, check the result.

## Exercises

Try these to practise. Each one fits the existing structure.

1. **Footer links:** a data-driven test that each policy link in the footer
   (Terms, Privacy, Returns, Shipping) opens its page with an `<h1>`.
2. **Sort A to Z:** check "Name: A to Z" puts names in alphabetical order
   (hint: `localeCompare`, and see how `prices()` works in `catalog-page.ts`).
3. **Registration form:** add a `RegisterPage` page object and test that its
   validation stops a bad submit. Mock `**/api/auth/register` for the happy path.
4. **Image gallery:** on a product with several photos, click "Show photo 2 of 3"
   and assert the main image changed.
5. **Sign out:** with a mocked session, open the account menu and sign out;
   mock `**/api/auth/logout` and assert you land on `/login`.
6. **Visual check:** `await expect(page).toHaveScreenshot()` on the 404 page.
   Run once to save the baseline, change some CSS, run again, and see it fail.
7. **Another browser:** add a `firefox` project to `playwright.config.ts`
   (`npx playwright install firefox`) and see whether everything still passes.

## When a test fails

1. Read the error. Playwright prints the locator, what it expected, and what it got.
2. Open the report (`npm run test:e2e:report`): it has a screenshot and video of the failure.
3. Rerun just that test in UI mode or with `--debug` and watch it.
4. Decide: is the **app** wrong (a bug to report), or the **test** (the page
   changed on purpose, or the live catalog changed)? Fix whichever it is.
