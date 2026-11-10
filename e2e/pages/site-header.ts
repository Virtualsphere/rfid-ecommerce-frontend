import type { Locator, Page } from "@playwright/test";

/**
 * The header on every storefront page: logo, main navigation, search,
 * account and cart. On phones the navigation and search move into a menu.
 */
export class SiteHeader {
  readonly root: Locator;
  readonly homeLink: Locator;
  readonly mainNav: Locator;
  readonly search: Locator;
  readonly signInLink: Locator;
  readonly accountMenu: Locator;
  readonly cartLink: Locator;
  readonly menuButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("banner");
    this.homeLink = this.root.getByRole("link", { name: /home$/ });
    this.mainNav = this.root.getByRole("navigation", { name: "Main" });
    this.search = this.root.getByRole("searchbox", { name: "Search products" });
    this.signInLink = this.root.getByRole("link", { name: "Sign in" });
    // Its accessible name is "Account: <user's name>".
    this.accountMenu = this.root.getByRole("button", { name: /^Account:/ });
    // "Cart", or "Cart, 3 items" once something is in it.
    this.cartLink = this.root.getByRole("link", { name: /^Cart/ });
    this.menuButton = this.root.getByRole("button", { name: /^(Open|Close) menu$/ });
  }

  navLink(label: string) {
    return this.mainNav.getByRole("link", { name: label, exact: true });
  }

  async searchFor(text: string) {
    await this.search.fill(text);
    await this.search.press("Enter");
  }
}
