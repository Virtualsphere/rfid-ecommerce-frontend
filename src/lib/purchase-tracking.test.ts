import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseEvent, reportPurchase, resetReportedForTests, type PurchasedOrder } from "./purchase-tracking";

const order = (extra: Partial<PurchasedOrder> = {}): PurchasedOrder => ({
  _id: "6710a4c2e1f0b3a9d4c5e6f7",
  totalPrice: 1416,
  subtotal: 1200,
  gstAmount: 216,
  paymentStatus: "Paid",
  items: [
    {
      quantity: 2,
      priceAtPurchase: 500,
      product: { _id: "p1", sku: "UDT-W3", name: "UDT-W3 Reader", category: { name: "RFID Readers" } },
    },
    {
      quantity: 10,
      priceAtPurchase: 20,
      product: { _id: "p2", name: "Wet inlay", category: null },
    },
  ],
  ...extra,
});

describe("purchaseEvent", () => {
  it("is a GA4 purchase with the order id, the pre-GST value, the GST as tax, and INR", () => {
    expect(purchaseEvent(order())).toEqual({
      event: "purchase",
      ecommerce: {
        transaction_id: "6710a4c2e1f0b3a9d4c5e6f7",
        value: 1200,
        tax: 216,
        shipping: 0,
        currency: "INR",
        items: [
          { item_id: "UDT-W3", item_name: "UDT-W3 Reader", item_category: "RFID Readers", price: 500, quantity: 2 },
          { item_id: "p2", item_name: "Wet inlay", price: 20, quantity: 10 },
        ],
      },
    });
  });

  it("works out the pre-GST value when the order has no subtotal", () => {
    const { ecommerce } = purchaseEvent(order({ subtotal: undefined, totalPrice: 1416.3, gstAmount: 216.05 }));
    expect(ecommerce.value).toBe(1200.25);
  });

  it("uses the whole amount for orders placed before GST was added", () => {
    const { ecommerce } = purchaseEvent(order({ subtotal: undefined, gstAmount: undefined, totalPrice: 900 }));
    expect(ecommerce).toMatchObject({ value: 900, tax: 0 });
  });

  it("leaves out products that no longer exist", () => {
    const { ecommerce } = purchaseEvent(order({ items: [{ quantity: 1, priceAtPurchase: 30, product: null }] }));
    expect(ecommerce.items).toEqual([]);
  });
});

describe("reportPurchase", () => {
  let dataLayer: unknown[];
  let storage: Map<string, string>;

  beforeEach(() => {
    dataLayer = [];
    storage = new Map();
    vi.stubGlobal("window", {
      dataLayer,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    resetReportedForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the previous ecommerce object, then pushes the purchase", () => {
    expect(reportPurchase(order())).toBe(true);
    expect(dataLayer).toEqual([{ ecommerce: null }, purchaseEvent(order())]);
  });

  it("pushes each order only once, even after the page reloads", () => {
    reportPurchase(order());
    resetReportedForTests(); // a reload starts with an empty in-memory set
    expect(reportPurchase(order())).toBe(false);
    expect(dataLayer).toHaveLength(2);
  });

  it("still pushes only once when this browser blocks storage", () => {
    vi.stubGlobal("window", {
      dataLayer,
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(reportPurchase(order())).toBe(true);
    expect(reportPurchase(order())).toBe(false);
    expect(dataLayer).toHaveLength(2);
  });

  it("reports different orders separately", () => {
    reportPurchase(order());
    expect(reportPurchase(order({ _id: "another" }))).toBe(true);
    expect(dataLayer).toHaveLength(4);
  });

  it("ignores orders that aren't paid", () => {
    expect(reportPurchase(order({ paymentStatus: "Pending" }))).toBe(false);
    expect(reportPurchase(order({ paymentStatus: undefined }))).toBe(false);
    expect(dataLayer).toEqual([]);
  });
});
