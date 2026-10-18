/**
 * Response shapes of the Express backend (RFID-BACKEND/src/models), as they
 * arrive over JSON: ObjectIds and Dates are strings, and populated references
 * are the `{ _id, name }` projection the controllers select.
 */

export type EntityRef = { _id: string; name: string };

export interface Product {
  _id: string;
  name: string;
  slug: string;
  /** Rich-text HTML authored in the admin editor. */
  description: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  productTags?: string;

  model: string;
  sku: string;
  upc?: string;
  ean?: string;
  jan?: string;
  isbn?: string;
  mpn?: string;

  price: number;
  compareAtPrice?: number;
  taxClass?: string;
  stock: number;
  minimumQuantity: number;
  subtractStock: boolean;
  outOfStockStatus?: string;
  dateAvailable?: string;
  dimensions?: { length: string; width: string; height: string };
  lengthClass?: string;
  weight?: number;
  weightClass?: string;

  /** False when an admin has disabled the product; the storefront must hide it. */
  status: boolean;
  sortOrder: number;
  /** Populated with the category's name; null if the category was deleted. */
  category: EntityRef | null;
  images: string[];
  specifications: { name: string; value: string }[];

  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  parent?: EntityRef | null;
  image?: string;
  sortOrder: number;
  status: boolean;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  productCount?: number;
  subcategoryCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** `GET /products` pages its results; `limit` defaults to 50 server-side. */
export interface ProductPage {
  products: Product[];
  page: number;
  pages: number;
  total: number;
}

/** A contact-form message (RFID-BACKEND Enquiry model). */
export interface Enquiry {
  _id: string;
  name: string;
  email: string;
  /** Required since October 2026; enquiries sent before then have none. */
  phone?: string;
  company?: string;
  /** One of ENQUIRY_SUBJECTS' values. */
  subject: string;
  message: string;
  /** Set when the visitor came from a product page's "Request a quote". */
  product?: string;
  quantity?: string;
  /** One of ENQUIRY_STATUSES. */
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

/** Login and register answer with the user plus a bearer token. */
export type AuthResponse = User & { token: string };
