import { describe, expect, it } from "vitest";
import {
  applyPostOffices,
  emptyShippingAddress,
  formatShippingAddress,
  shippingAddressProblem,
  type ShippingAddress,
} from "./address";
import type { PostOffice } from "./pincode";

const DELHI: PostOffice[] = [
  { name: "Baroda House", district: "Central Delhi", state: "Delhi" },
  { name: "Connaught Place", district: "Central Delhi", state: "Delhi" },
  { name: "New Delhi", district: "New Delhi", state: "Delhi" },
];

const complete: ShippingAddress = {
  fullName: "Rahul Sharma",
  phone: "+91 98765 43210",
  pincode: "110001",
  locality: "Connaught Place",
  line1: "Flat 4B, Sunrise Apartments",
  line2: "MG Road",
  landmark: "",
  city: "Central Delhi",
  state: "Delhi",
};

describe("applyPostOffices", () => {
  it("picks a lone office outright", () => {
    const single = [{ name: "Kasauli", district: "Solan", state: "Himachal Pradesh" }];
    expect(applyPostOffices(emptyShippingAddress(), single)).toMatchObject({
      locality: "Kasauli",
      city: "Solan",
      state: "Himachal Pradesh",
    });
  });

  it("leaves the locality to choose among several, with the district most share as the city", () => {
    expect(applyPostOffices(emptyShippingAddress(), DELHI)).toMatchObject({
      locality: "",
      city: "Central Delhi",
      state: "Delhi",
    });
  });

  it("keeps a chosen locality the new list still has, and takes its district", () => {
    const address = { ...emptyShippingAddress(), locality: "New Delhi" };
    expect(applyPostOffices(address, DELHI)).toMatchObject({ locality: "New Delhi", city: "New Delhi" });
  });

  it("replaces everything from a previous PIN code", () => {
    const bangalore = [
      { name: "Bangalore", district: "Bangalore", state: "Karnataka" },
      { name: "Bangalore Bazaar", district: "Bangalore", state: "Karnataka" },
    ];
    expect(applyPostOffices(complete, bangalore)).toMatchObject({
      locality: "",
      city: "Bangalore",
      state: "Karnataka",
      line1: complete.line1,
    });
  });
});

describe("shippingAddressProblem", () => {
  const found = { status: "found" as const, postOffices: DELHI };

  it("passes a complete address", () => {
    expect(shippingAddressProblem(complete, found)).toBeNull();
  });

  it.each<[keyof ShippingAddress, string]>([
    ["fullName", "  "],
    ["phone", "12345"],
    ["phone", "+1 415 555 0134"],
    ["pincode", "11000"],
    ["locality", ""],
    ["locality", "Somewhere Else"],
    ["line1", ""],
    ["line2", " "],
    ["city", ""],
    ["state", ""],
  ])("flags %s when it is %j", (field, value) => {
    expect(shippingAddressProblem({ ...complete, [field]: value }, found)?.field).toBe(field);
  });

  it("reports the first problem in the order the fields appear", () => {
    const problem = shippingAddressProblem({ ...complete, phone: "", line1: "" }, found);
    expect(problem?.field).toBe("phone");
  });

  it("waits for the PIN code check to finish", () => {
    expect(shippingAddressProblem(complete, { status: "loading", postOffices: [] })).toMatchObject({
      field: "pincode",
      message: expect.stringMatching(/still checking/i),
    });
  });

  it("refuses a PIN code India Post doesn't know", () => {
    expect(shippingAddressProblem(complete, { status: "not-found", postOffices: [] })).toMatchObject({
      field: "pincode",
      message: expect.stringMatching(/couldn't find/i),
    });
  });

  it("lets an unchecked PIN code through when the lookup is down, without a locality", () => {
    const typed = { ...complete, locality: "" };
    expect(shippingAddressProblem(typed, { status: "unavailable", postOffices: [] })).toBeNull();
  });
});

describe("formatShippingAddress", () => {
  it("lays the address out as label lines", () => {
    expect(formatShippingAddress({ ...complete, landmark: "Near Regal Cinema" })).toBe(
      [
        "Rahul Sharma",
        "Flat 4B, Sunrise Apartments",
        "MG Road",
        "Landmark: Near Regal Cinema",
        "Connaught Place, Central Delhi",
        "Delhi 110001",
        "India",
      ].join("\n")
    );
  });

  it("skips empty lines and a locality that only repeats the city", () => {
    expect(formatShippingAddress({ ...complete, locality: "new delhi", city: "New Delhi" })).toBe(
      ["Rahul Sharma", "Flat 4B, Sunrise Apartments", "MG Road", "New Delhi", "Delhi 110001", "India"].join("\n")
    );
  });

  it("tidies stray whitespace", () => {
    const messy = { ...complete, fullName: "  Rahul   Sharma ", line2: "MG  Road\t" };
    const lines = formatShippingAddress(messy).split("\n");
    expect(lines[0]).toBe("Rahul Sharma");
    expect(lines[2]).toBe("MG Road");
  });
});
