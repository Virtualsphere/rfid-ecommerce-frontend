import type { Locator, Page } from "@playwright/test";
import { openPage } from "../support/navigation";

export type EnquiryForm = {
  name: string;
  email: string;
  phone: string;
  company?: string;
  /** The option's visible label, e.g. "Technical question". */
  subject: string;
  message: string;
};

/** /contact: the enquiry form, which the product pages' "Request a quote" pre-fills. */
export class ContactPage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly company: Locator;
  readonly subject: Locator;
  readonly message: Locator;
  readonly send: Locator;
  readonly phoneError: Locator;
  readonly sendError: Locator;
  readonly thankYou: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole("main");
    this.heading = main.getByRole("heading", { level: 1 });
    this.name = main.getByRole("textbox", { name: "Full name" });
    this.email = main.getByRole("textbox", { name: "Email address" });
    this.phone = main.getByRole("textbox", { name: "Phone number" });
    this.company = main.getByRole("textbox", { name: "Company (optional)" });
    this.subject = main.getByRole("combobox", { name: "Subject" });
    this.message = main.getByRole("textbox", { name: "Message" });
    this.send = main.getByRole("button", { name: "Send message" });
    this.phoneError = main.getByText("Please enter a valid phone number.", { exact: false });
    this.sendError = main.getByRole("alert");
    this.thankYou = main.getByRole("heading", { name: "Thank you for contacting us!" });
  }

  async goto() {
    await openPage(this.page, "/contact");
  }

  async fill(form: EnquiryForm) {
    await this.name.fill(form.name);
    await this.email.fill(form.email);
    await this.phone.fill(form.phone);
    if (form.company) await this.company.fill(form.company);
    await this.subject.selectOption({ label: form.subject });
    await this.message.fill(form.message);
  }
}
