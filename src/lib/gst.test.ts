import { describe, expect, it } from "vitest";
import { GST_PERCENT, withGst } from "./gst";

describe("withGst", () => {
  it("adds 18% on top of the subtotal", () => {
    expect(GST_PERCENT).toBe(18);
    expect(withGst(10000)).toEqual({ subtotal: 10000, gst: 1800, total: 11800 });
    expect(withGst(51000)).toEqual({ subtotal: 51000, gst: 9180, total: 60180 });
  });

  it("rounds GST to the nearest paisa", () => {
    // 18% of ₹99.99 is ₹17.9982
    expect(withGst(99.99)).toEqual({ subtotal: 99.99, gst: 18, total: 117.99 });
    // 18% of ₹0.25 is ₹0.045: rounds up to a paisa-exact 0.05
    expect(withGst(0.25).gst).toBe(0.05);
  });

  it("isn't thrown by floating point", () => {
    // 0.1 + 0.2 is 0.30000000000000004 as a double.
    expect(withGst(0.1 + 0.2)).toEqual({ subtotal: 0.3, gst: 0.05, total: 0.35 });
  });

  it("charges nothing on an empty cart", () => {
    expect(withGst(0)).toEqual({ subtotal: 0, gst: 0, total: 0 });
  });
});
