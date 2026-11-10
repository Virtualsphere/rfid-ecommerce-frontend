import { test, expect } from "../fixtures";
import type { EnquiryForm } from "../pages/contact-page";
import { mockEnquiry } from "../support/mock-api";

/**
 * The contact form. A real submission lands in the shop's admin panel, so
 * every submit here is answered by a mock: the backend never sees it.
 */

const VALID_ENQUIRY: EnquiryForm = {
  name: "Asha Verma",
  email: "asha@example.com",
  phone: "+91 98765 43210",
  company: "Example Logistics",
  subject: "Technical question",
  message: "What read range does the UHR2 get on metal pallets?",
};

test.beforeEach(async ({ contactPage }) => {
  await contactPage.goto();
});

test("required fields stop an empty form from being sent", async ({ page, contactPage }) => {
  const calls = await mockEnquiry(page, 201, { message: "ok" });

  await contactPage.send.click();

  // Native browser validation: the first empty required field is invalid.
  const message = await contactPage.name.evaluate((input: HTMLInputElement) => input.validationMessage);
  expect(message).not.toBe("");
  expect(calls).toHaveLength(0);
});

test("an email address without an @ is rejected", async ({ page, contactPage }) => {
  const calls = await mockEnquiry(page, 201, { message: "ok" });
  await contactPage.fill({ ...VALID_ENQUIRY, email: "asha.example.com" });

  await contactPage.send.click();

  expect(await contactPage.email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
  expect(calls).toHaveLength(0);
});

// Boundary values around the 10–15 digit rule for phone numbers.
const BAD_PHONES = ["12345", "987654321", "+91 98765 43210 9999", "98765-ABCDE"];
for (const phone of BAD_PHONES) {
  test(`phone number "${phone}" is rejected`, async ({ page, contactPage }) => {
    const calls = await mockEnquiry(page, 201, { message: "ok" });
    await contactPage.fill({ ...VALID_ENQUIRY, phone });

    await contactPage.send.click();

    await expect(contactPage.phoneError).toBeVisible();
    await expect(contactPage.phone).toHaveAttribute("aria-invalid", "true");
    await expect(contactPage.phone).toBeFocused();
    expect(calls).toHaveLength(0);
  });
}

test("a valid enquiry is sent and thanked", async ({ page, contactPage }) => {
  const calls = await mockEnquiry(page, 201, { message: "Enquiry received" });
  await contactPage.fill(VALID_ENQUIRY);

  await contactPage.send.click();

  await expect(contactPage.thankYou).toBeVisible();
  await expect(page.getByRole("main")).toContainText(`Our reply will go to ${VALID_ENQUIRY.email}.`);

  // Check what was actually sent, not just what the page shows.
  expect(calls).toHaveLength(1);
  expect(calls[0].method()).toBe("POST");
  expect(calls[0].postDataJSON()).toMatchObject({
    name: VALID_ENQUIRY.name,
    email: VALID_ENQUIRY.email,
    phone: VALID_ENQUIRY.phone,
    company: VALID_ENQUIRY.company,
    subject: "technical",
    message: VALID_ENQUIRY.message,
    // The hidden anti-spam field stays empty for real people.
    website: "",
  });
});

// A test of the test setup itself: proof that a forgotten mock can't send a
// real enquiry. The safety net in fixtures.ts answers instead of the backend.
test("without a mock, the safety net stops the enquiry reaching the shop", async ({ contactPage }) => {
  await contactPage.fill(VALID_ENQUIRY);

  await contactPage.send.click();

  await expect(contactPage.sendError).toContainText("Blocked by the e2e safety net");
  await expect(contactPage.thankYou).toBeHidden();
});

test("if sending fails, the visitor can email the message instead", async ({ page, contactPage }) => {
  await mockEnquiry(page, 500, { message: "Internal Server Error" });
  await contactPage.fill(VALID_ENQUIRY);

  await contactPage.send.click();

  await expect(contactPage.sendError).toContainText("We couldn't send your message just now.");
  const emailLink = contactPage.sendError.getByRole("link", { name: /^email it to/ });
  await expect(emailLink).toHaveAttribute("href", /^mailto:info@virtualspheretechnologies\.in\?subject=Technical%20question/);
  // What they typed is kept, so nothing is lost.
  await expect(contactPage.message).toHaveValue(VALID_ENQUIRY.message);
});
