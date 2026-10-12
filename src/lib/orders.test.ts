import { describe, expect, it } from "vitest";
import { orderConfirmationPath, orderNumber } from "./orders";
import { safeRedirectPath } from "./redirect";

describe("orderNumber", () => {
  it("is the id's last 8 characters in capitals", () => {
    expect(orderNumber("6710a4c2e1f0b3a9d4c5e6f7")).toBe("D4C5E6F7");
  });
});

describe("orderConfirmationPath", () => {
  it("carries the order id in the query string", () => {
    expect(orderConfirmationPath("6710a4c2e1f0b3a9d4c5e6f7")).toBe("/checkout/thank-you?order=6710a4c2e1f0b3a9d4c5e6f7");
  });

  it("escapes anything that would break out of the parameter", () => {
    expect(orderConfirmationPath("a&b=c")).toBe("/checkout/thank-you?order=a%26b%3Dc");
  });

  it("survives a round trip through the sign-in redirect", () => {
    const path = orderConfirmationPath("6710a4c2e1f0b3a9d4c5e6f7");
    const redirect = new URLSearchParams(`redirect=${encodeURIComponent(path)}`).get("redirect");
    expect(safeRedirectPath(redirect)).toBe(path);
  });
});
