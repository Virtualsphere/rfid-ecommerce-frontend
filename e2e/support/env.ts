/**
 * The session secret the test server runs with (see playwright.config.ts).
 *
 * It only ever encrypts cookies on the throwaway server Playwright starts on
 * port 3100, never a real one. Knowing it lets a test mint a session cookie
 * the server will accept (see auth.spec.ts).
 */
export const E2E_SESSION_SECRET = "playwright-e2e-only-session-secret-0000";

/**
 * True when the tests run against a server Playwright didn't start (BASE_URL
 * is set). Such a server has its own secret, so minted cookies won't work.
 */
export const usingExternalServer = Boolean(process.env.BASE_URL);
