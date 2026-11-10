/**
 * Data the tests use.
 *
 * Two kinds:
 *  - LIVE_PRODUCT is a real product in the live catalog. Tests that read it
 *    depend on it existing; if it's ever removed, point this at another one.
 *  - Everything else is made up. It's served by network mocks (see
 *    mock-api.ts), so no real account, cart or order is ever touched.
 */

/** A real catalog product (also pinned in the home page showcase). */
export const LIVE_PRODUCT = {
  slug: "udt-w3-uhf-rfid-table-top-reader",
  searchTerm: "UDT-W3",
  /** Part of its name, which is long and edited from time to time. */
  namePart: "UDT-W3 UHF RFID Table Top Reader",
};

export type TestUser = {
  _id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
};

export const TEST_CUSTOMER: TestUser = {
  _id: "e2e-user-1",
  name: "Test Customer",
  email: "test.customer@example.com",
  role: "customer",
};

/** The fields of a product the cart page reads. */
export type CartProduct = {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  minimumQuantity: number;
  images: string[];
};

export type CartLine = { product: CartProduct; quantity: number };

export const FAKE_READER: CartProduct = {
  _id: "e2e-product-reader",
  name: "Test UHF Desktop Reader",
  slug: "test-uhf-desktop-reader",
  sku: "TEST-READER",
  price: 10_000,
  stock: 25,
  minimumQuantity: 1,
  images: [],
};

/** Tags sell in hundreds, so this one has a minimum order of 500. */
export const FAKE_TAG: CartProduct = {
  _id: "e2e-product-tag",
  name: "Test UHF RFID Tag",
  slug: "test-uhf-rfid-tag",
  sku: "TEST-TAG",
  price: 5,
  stock: 10_000,
  minimumQuantity: 500,
  images: [],
};

/**
 * A cart worth ₹12,500 before tax:
 *   1 × reader at ₹10,000   = ₹10,000
 *   500 × tag at ₹5         =  ₹2,500
 * With 18% GST the order total is ₹14,750.
 */
export const SAMPLE_CART: CartLine[] = [
  { product: FAKE_READER, quantity: 1 },
  { product: FAKE_TAG, quantity: 500 },
];

/** What /api/pincode/110001 answers for Connaught Place, New Delhi. */
export const NEW_DELHI_PINCODE = {
  pincode: "110001",
  postOffices: [
    { name: "Baroda House", district: "New Delhi", state: "Delhi" },
    { name: "Connaught Place", district: "New Delhi", state: "Delhi" },
  ],
};
