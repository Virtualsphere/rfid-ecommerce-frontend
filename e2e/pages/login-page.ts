import type { Locator, Page } from "@playwright/test";
import { openPage } from "../support/navigation";

/** /login */
export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Sign in", level: 1 });
    this.email = page.getByRole("textbox", { name: "Email address" });
    // Password fields have no role, so find this one by its <label>.
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: "Sign in" });
    // The form's error message. (Next.js keeps an empty route-announcer
    // alert on every page, so this one is picked out by having text.)
    this.error = page.getByRole("alert").filter({ hasText: /\S/ });
  }

  /** Open the login page, optionally with ?redirect= set. */
  async goto(redirect?: string) {
    await openPage(this.page, redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login");
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
