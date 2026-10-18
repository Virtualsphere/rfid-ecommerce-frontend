import { afterEach, describe, expect, it, vi } from "vitest";
import { isPincode, lookupPincode, parsePostOffices } from "./pincode";

afterEach(() => {
  vi.unstubAllGlobals();
});

// Trimmed from api.postalpincode.in's real answers.
const office = (Name: string, District: string, State = "Delhi") => ({
  Name,
  Description: null,
  BranchType: "Sub Post Office",
  DeliveryStatus: "Non-Delivery",
  Circle: State,
  District,
  Division: "New Delhi Central",
  Region: State,
  Block: "New Delhi",
  State,
  Country: "India",
  Pincode: "110001",
});

describe("isPincode", () => {
  it.each(["110001", "560001", "999999"])("accepts %s", (value) => expect(isPincode(value)).toBe(true));
  it.each(["", "11000", "1100011", "011001", "11 0001", "abcdef"])("refuses %j", (value) =>
    expect(isPincode(value)).toBe(false)
  );
});

describe("parsePostOffices", () => {
  it("lists a known PIN code's offices, trimmed, deduplicated and sorted", () => {
    const body = [
      {
        Message: "Number of pincode(s) found:3",
        Status: "Success",
        PostOffice: [
          office("New Delhi ", "New Delhi"),
          office("Connaught Place", "Central Delhi"),
          office("Baroda House", "Central Delhi"),
          office("Connaught Place", "Central Delhi"),
        ],
      },
    ];
    expect(parsePostOffices(body)).toEqual([
      { name: "Baroda House", district: "Central Delhi", state: "Delhi" },
      { name: "Connaught Place", district: "Central Delhi", state: "Delhi" },
      { name: "New Delhi", district: "New Delhi", state: "Delhi" },
    ]);
  });

  it("answers an unknown PIN code with no offices", () => {
    expect(parsePostOffices([{ Message: "No records found", Status: "Error", PostOffice: null }])).toEqual([]);
  });

  it("drops entries without a name or state", () => {
    const body = [{ Status: "Success", PostOffice: [office("", "X"), { Name: "Lone" }, office("Kept", "Y")] }];
    expect(parsePostOffices(body)).toEqual([{ name: "Kept", district: "Y", state: "Delhi" }]);
  });

  it.each([
    ["an object instead of the array", { Status: "Success", PostOffice: [] }],
    ["an empty array", []],
    ["the service's own 404", [{ Status: "404", Message: "The requested resource is not found" }]],
    ["success without offices", [{ Status: "Success", PostOffice: null }]],
    ["HTML", "<html>"],
    ["nothing", null],
  ])("doesn't recognise %s", (_label, body) => {
    expect(parsePostOffices(body)).toBeNull();
  });
});

describe("lookupPincode", () => {
  const answer = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

  const offices = [{ name: "Connaught Place", district: "Central Delhi", state: "Delhi" }];

  it("asks this app's own route", async () => {
    answer(200, { pincode: "110001", postOffices: offices });
    await lookupPincode("110001");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/pincode/110001");
  });

  it("returns the offices of a known PIN code", async () => {
    answer(200, { pincode: "110001", postOffices: offices });
    expect(await lookupPincode("110001")).toEqual({ status: "found", postOffices: offices });
  });

  it("reports an unknown PIN code", async () => {
    answer(404, { message: "No post office has this PIN code." });
    expect(await lookupPincode("999999")).toEqual({ status: "not-found" });
  });

  it("reports an outage as unavailable, not as a bad PIN code", async () => {
    answer(502, { message: "PIN code lookup is unavailable right now." });
    expect(await lookupPincode("110001")).toEqual({ status: "unavailable" });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await lookupPincode("110001")).toEqual({ status: "unavailable" });
  });

  it("rethrows when the caller abandoned the lookup", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("Aborted", "AbortError"))));
    await expect(lookupPincode("110001", controller.signal)).rejects.toThrow("Aborted");
  });
});
