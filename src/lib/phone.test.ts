import { describe, expect, it } from "vitest";
import { formatIndianMobile, indianMobile, isPhoneNumber } from "./phone";

describe("isPhoneNumber", () => {
  it.each(["9876543210", "+91 98765 43210", "+91-98765-43210", "(022) 2345 6789", "+1 (415) 555-0134", "+971 50 123 4567"])(
    "accepts %s",
    (value) => expect(isPhoneNumber(value)).toBe(true)
  );

  it.each(["", "12345", "98765 4321", "+65 6123 4567 8901 23", "call me", "98765x43210", "+91 98765 43210 ext 2"])(
    "refuses %j",
    (value) => expect(isPhoneNumber(value)).toBe(false)
  );
});

describe("indianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["  +91-6123456789 ", "6123456789"],
  ])("reads %j as %s", (value, digits) => expect(indianMobile(value)).toBe(digits));

  it.each(["", "5876543210", "987654321", "98765432101", "+1 415 555 0134", "02223456789", "98765abc10"])(
    "refuses %j",
    (value) => expect(indianMobile(value)).toBeNull()
  );
});

describe("formatIndianMobile", () => {
  it("groups the number the way it's read aloud", () => {
    expect(formatIndianMobile("9876543210")).toBe("+91 98765 43210");
  });
});
