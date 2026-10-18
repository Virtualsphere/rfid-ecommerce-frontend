import { API_URL } from './config';
import type { AuthResponse, Category, Enquiry, Product, ProductPage } from '@/types';

const isServer = typeof window === 'undefined';

/**
 * How long the server may reuse a cached response for a public read.
 *
 * The backend runs under Passenger on shared hosting: a request that arrives
 * against a cold worker waits tens of seconds for the process to boot (55s and
 * 94s were both measured against production). Serving these routes from the
 * cache means that cost is paid by a background revalidation instead of by a
 * visitor.
 */
export const REVALIDATE = {
  // Deliberately under the backend's measured spin-down window. Passenger
  // retires an idle worker after ~5 minutes (probed: 4 min idle answered in
  // 0.19s, 6 min idle in 25.7s), and the next request then pays a 25-94s
  // respawn. Revalidating at 4 minutes means ordinary traffic re-touches the
  // origin just often enough to keep the worker alive, so the cache refresh
  // lands on a warm process instead of paying for a boot.
  products: 240,
  categories: 600,
} as const;

/**
 * Budget for a single attempt at a public read.
 *
 * This is deliberately far below the backend's worst observed cold start. The
 * point is not to outwait a stalled backend — it is to bound how long a render
 * can sit on one. Product sections render inside their own Suspense boundary,
 * so exceeding this budget costs a skeleton and a retry affordance, never a
 * blank page. Two attempts at 10s plus backoff caps a failing read at ~21s.
 */
const READ_TIMEOUT_MS = 10_000;

/**
 * The same budget for a read made from the browser, i.e. the admin panel.
 *
 * An admin is looking at a spinner and wants the real list, not a skeleton, so
 * the budget has to outlast a cold start (up to 94s measured). At 10s the lists
 * came back empty whenever the backend had been idle, which reads as "all my
 * products are gone".
 */
const BROWSER_READ_TIMEOUT_MS = 100_000;

/**
 * Statuses worth trying again: the request may well succeed on a second go.
 * Everything else (400/401/403/404/422 …) is a deterministic answer — retrying
 * it just multiplies load on an already unhealthy backend.
 */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Page size for walking the full catalog. `GET /products` pages its results
 * and defaults to 50 per page, so a single unparameterised call silently drops
 * everything past the 50th product.
 */
const CATALOG_PAGE_SIZE = 100;

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ReadOptions = {
  /** Seconds the Next.js server may serve this response from cache. */
  revalidate?: number;
  /** Cache tags, so an admin mutation can flush the public cache on demand. */
  tags?: string[];
  timeoutMs?: number;
  retries?: number;
};

/** A transport-level failure (DNS, reset, abort) is always worth one more try. */
const isTransientNetworkError = (error: unknown) =>
  error instanceof TypeError || // fetch throws TypeError on network failure
  (error instanceof DOMException && error.name === 'TimeoutError') ||
  (error as { name?: string })?.name === 'AbortError' ||
  (error as { name?: string })?.name === 'TimeoutError';

const backoffMs = (attempt: number) =>
  // Exponential with jitter, so a burst of renders doesn't retry in lockstep.
  Math.round(400 * 2 ** attempt * (0.5 + Math.random()));

/**
 * One GET against the backend, within `timeoutMs`.
 *
 * The server calls the backend directly. The browser tries that first too, but
 * a direct call is only allowed if the backend's CORS list names the page's
 * origin, and that list holds one deployed origin besides localhost. On any
 * other address for the site (a Vercel alias, a preview, a custom domain) the
 * call is blocked, and the admin lists came up empty while localhost, which is
 * always allowed, worked. A blocked call is indistinguishable from being
 * offline (both a TypeError), so on one the read is repeated through this app's
 * own `/api/backend` route, which is same-origin and so not subject to CORS.
 */
async function fetchBackend(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  // One signal for both attempts, so the fallback can't extend the budget.
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal });
  } catch (error) {
    if (isServer || !(error instanceof TypeError)) throw error;
    return await fetch(`/api/backend${path}`, { ...init, signal });
  }
}

/**
 * GET a public endpoint with a bounded time budget and one retry.
 *
 * On the server the response is cached for `revalidate` seconds. In the browser
 * (the admin panel) it always goes to the network, so admins never see stale data.
 */
async function readJson<T>(
  path: string,
  {
    revalidate = 0,
    tags,
    timeoutMs = isServer ? READ_TIMEOUT_MS : BROWSER_READ_TIMEOUT_MS,
    retries = 1,
  }: ReadOptions = {}
): Promise<T> {
  const init: RequestInit = isServer
    ? { next: { revalidate, ...(tags ? { tags } : {}) } }
    : { cache: 'no-store' };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchBackend(path, init, timeoutMs);

      if (res.ok) return (await res.json()) as T;

      const error = new ApiError(`Request failed: ${path} -> ${res.status}`, res.status);

      // A definitive answer (including 404) — don't spend another attempt on it.
      if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) throw error;

      lastError = error;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;

      // Rethrow anything already classified as non-retryable.
      if (status !== undefined && !RETRYABLE_STATUS.has(status)) throw error;
      if (status === undefined && !isTransientNetworkError(error)) throw error;

      lastError = error;
      if (attempt === retries) break;
    }

    await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
  }

  throw lastError instanceof Error ? lastError : new ApiError(`Request failed: ${path}`);
}

/** The backend's own error message, or `fallback` when the body has none. */
async function messageFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string' && body.message) return body.message;
  } catch {
    // Not JSON: a proxy's HTML error page, or an empty 502.
  }
  return fallback;
}

/**
 * Where authenticated calls go. The browser never holds the backend token —
 * it lives in the httpOnly session cookie — so browser calls go through this
 * app's `/api/backend` route, which attaches the token server-side. Server
 * code (the auth route handlers) talks to the backend directly.
 */
const requestBase = () => (isServer ? API_URL : '/api/backend');

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Sent as JSON, unless it's FormData, which sets its own multipart header. */
  body?: unknown;
  /** Shown when the backend doesn't explain the failure itself. */
  errorMessage: string;
};

/**
 * An authenticated or mutating call. Never cached and never retried: repeating
 * a POST that timed out could place the same order twice.
 *
 * Failures throw an `ApiError` carrying the backend's message when it sent
 * one, so forms can show "SKU already exists" rather than a generic error.
 */
async function request<T>(
  path: string,
  { method = 'GET', body, errorMessage }: RequestOptions
): Promise<T> {
  const headers: Record<string, string> = {};

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${requestBase()}${path}`, {
    method,
    headers,
    body: payload,
    cache: 'no-store',
  });

  if (!res.ok) throw new ApiError(await messageFrom(res, errorMessage), res.status);
  return (await res.json()) as T;
}

/** Page size for walking the backend's paginated admin lists (50 by default). */
const ADMIN_PAGE_SIZE = 100;

/**
 * Every row of a paginated admin endpoint. `GET /orders` and
 * `GET /admin/users` return 50 rows unless asked for a page, so a single call
 * silently hid everything past the 50th order or customer.
 */
async function requestAllPages<T>(
  path: string,
  key: 'orders' | 'users' | 'enquiries',
  errorMessage: string
): Promise<T[]> {
  type Page = { [k: string]: unknown; pages?: number };
  const pageUrl = (page: number) => `${path}?page=${page}&limit=${ADMIN_PAGE_SIZE}`;
  const rowsOf = (data: Page | T[]) =>
    (Array.isArray(data) ? data : ((data[key] as T[] | undefined) ?? []));

  const first = await request<Page | T[]>(pageUrl(1), { errorMessage });
  if (Array.isArray(first)) return first;

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, (first.pages ?? 1) - 1) }, (_, i) =>
      request<Page>(pageUrl(i + 2), { errorMessage })
    )
  );
  return [first, ...rest].flatMap(rowsOf);
}

// ─── Public catalog reads ─────────────────────────────────────────────────────

/**
 * Catalog fetch that reports failure instead of hiding it behind an empty array.
 * A caller that prerenders needs to tell "the shop has no products" apart from
 * "the backend didn't answer in time" — caching the latter as a static page
 * leaves the site showing "No products available" until the next revalidation.
 *
 * @param limit Fetch only the first `limit` products. Omit it to walk every
 *   page of the catalog.
 * @param activeOnly Drop products an admin has disabled. Every storefront read
 *   sets this; the admin panel doesn't, so it can still list and re-enable them.
 */
export async function fetchProductsResult(
  { limit, activeOnly = false }: { limit?: number; activeOnly?: boolean } = {}
): Promise<{ products: Product[]; ok: boolean }> {
  const readPage = async (page: number, pageSize: number) => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (activeOnly) params.set('status', 'true');
    const data = await readJson<ProductPage>(`/products?${params}`, {
      revalidate: REVALIDATE.products,
      tags: ['products'],
    });
    return { products: data?.products ?? [], pages: data?.pages ?? 1 };
  };

  try {
    if (limit) return { products: (await readPage(1, limit)).products, ok: true };

    const first = await readPage(1, CATALOG_PAGE_SIZE);
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
        readPage(i + 2, CATALOG_PAGE_SIZE)
      )
    );
    return { products: [first, ...rest].flatMap((page) => page.products), ok: true };
  } catch (error) {
    console.error(`[api] products fetch failed: ${(error as Error).message}`);
    return { products: [], ok: false };
  }
}

/** Every product, enabled or not — what the admin panel's tables need. */
export async function fetchProducts(): Promise<Product[]> {
  return (await fetchProductsResult()).products;
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await readJson<Product>(`/products/slug/${encodeURIComponent(slug)}`, {
      revalidate: REVALIDATE.products,
      tags: ['products', `product:${slug}`],
    });
  } catch (error) {
    if ((error as ApiError)?.status !== 404) {
      console.error('Error fetching product by slug:', error);
    }
    return null;
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    return await readJson<Product>(`/products/${id}`);
  } catch (error) {
    if ((error as ApiError)?.status === 404) return null;
    throw error;
  }
}

/** Category fetch that reports failure — see `fetchProductsResult`. */
export async function fetchCategoriesResult(filters?: {
  name?: string;
  status?: string;
}): Promise<{ categories: Category[]; ok: boolean }> {
  try {
    const params = new URLSearchParams();
    if (filters?.name) params.set('name', filters.name);
    if (filters?.status !== undefined && filters?.status !== '') params.set('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await readJson<Category[] | { categories: Category[] }>(`/categories${query}`, {
      revalidate: REVALIDATE.categories,
      tags: ['categories'],
    });
    const categories = Array.isArray(data) ? data : data?.categories;
    return { categories: Array.isArray(categories) ? categories : [], ok: true };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { categories: [], ok: false };
  }
}

export async function fetchCategories(filters?: { name?: string; status?: string }) {
  return (await fetchCategoriesResult(filters)).categories;
}

export async function fetchCategoryById(id: string): Promise<Category | null> {
  try {
    return await readJson<Category>(`/categories/${id}`);
  } catch (error) {
    if ((error as ApiError)?.status === 404) return null;
    throw error;
  }
}

// ─── Auth (server-side only: called by the /api/auth route handlers) ──────────

export const login = (email: string, password: string) =>
  request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    errorMessage: 'Login failed',
  });

export const register = (name: string, email: string, password: string) =>
  request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { name, email, password },
    errorMessage: 'Registration failed',
  });

// ─── Admin: catalog management ────────────────────────────────────────────────

export const createCategory = (data: unknown) =>
  request<Category>('/categories', {
    method: 'POST',
    body: data,
    errorMessage: 'Failed to create category',
  });

export const updateCategory = (id: string, data: unknown) =>
  request<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: data,
    errorMessage: 'Failed to update category',
  });

export const deleteCategory = (id: string) =>
  request<unknown>(`/categories/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete category',
  });

export const deleteCategoriesBulk = (ids: string[]) =>
  request<unknown>('/categories', {
    method: 'DELETE',
    body: { ids },
    errorMessage: 'Failed to delete categories',
  });

export const createProduct = (data: unknown) =>
  request<Product>('/products', {
    method: 'POST',
    body: data,
    errorMessage: 'Failed to create product',
  });

export const updateProduct = (id: string, data: unknown) =>
  request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: data,
    errorMessage: 'Failed to update product',
  });

export const deleteProduct = (id: string) =>
  request<unknown>(`/products/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete product',
  });

export const deleteProductsBulk = (ids: string[]) =>
  request<unknown>('/products', {
    method: 'DELETE',
    body: { ids },
    errorMessage: 'Failed to delete products',
  });

/** Returns the stored path of the uploaded file, e.g. "/uploads/image-123.png". */
export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  return request<string>('/upload', {
    method: 'POST',
    body: formData,
    errorMessage: 'Failed to upload image',
  });
}

/** Returns the stored paths of the uploaded files, in upload order. */
export function uploadImages(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  return request<string[]>('/upload/multiple', {
    method: 'POST',
    body: formData,
    errorMessage: 'Failed to upload images',
  });
}

// ─── Cart & orders ────────────────────────────────────────────────────────────
// Response shapes below aren't modelled in `@/types` yet.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const fetchCart = () => request<any>('/cart', { errorMessage: 'Failed to fetch cart' });

export const addToCart = (productId: string, quantity: number) =>
  request<any>('/cart/add', {
    method: 'POST',
    body: { productId, quantity },
    errorMessage: 'Failed to add to cart',
  });

export const removeFromCart = (productId: string) =>
  request<any>('/cart/remove', {
    method: 'POST',
    body: { productId },
    errorMessage: 'Failed to remove from cart',
  });

export const updateCartQuantity = (productId: string, quantity: number) =>
  request<any>('/cart/update', {
    method: 'POST',
    body: { productId, quantity },
    errorMessage: 'Failed to update cart quantity',
  });

/** What `POST /orders` answers with once the Razorpay order exists. */
export type CreatedOrder = {
  order: { _id: string; totalPrice: number };
  razorpayOrderId: string;
  /** Razorpay's public key id, from the backend's own configuration. Older backends omit it. */
  keyId?: string;
  /** The order amount in paise, as Razorpay holds it. Older backends omit it. */
  amount?: number;
};

export const createOrder = (shippingAddress: string, phoneNumber: string) =>
  request<CreatedOrder>('/orders', {
    method: 'POST',
    body: { shippingAddress, phoneNumber },
    errorMessage: 'Failed to create order',
  });

export const verifyRazorpayPayment = (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) =>
  request<any>('/payment/verify', {
    method: 'POST',
    body: data,
    errorMessage: 'Payment verification failed',
  });

export async function fetchMyOrders() {
  const data = await request<any>('/orders/myorders', { errorMessage: 'Failed to fetch orders' });
  return data.orders || data;
}

// ─── Admin: operations ────────────────────────────────────────────────────────

/** Every placed order (the backend excludes ones still awaiting payment). */
export const fetchAllOrders = () =>
  requestAllPages<any>('/orders', 'orders', 'Failed to fetch all orders');

export const updateOrderStatus = (orderId: string, status: string) =>
  request<any>(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: { status },
    errorMessage: 'Failed to update order status',
  });

// ─── Enquiries (contact form) ─────────────────────────────────────────────────

/** What the contact form sends. `website` is the honeypot and must stay empty. */
export type EnquiryInput = {
  name: string;
  email: string;
  phone: string;
  company?: string;
  subject: string;
  message: string;
  product?: string;
  quantity?: string;
  website?: string;
};

/** Public: stores a contact-form message for the admin panel. */
export const submitEnquiry = (data: EnquiryInput) =>
  request<{ message: string }>('/enquiries', {
    method: 'POST',
    body: data,
    errorMessage: 'We could not send your message right now.',
  });

export const fetchEnquiries = () =>
  requestAllPages<Enquiry>('/enquiries', 'enquiries', 'Failed to fetch enquiries');

export const updateEnquiryStatus = (id: string, status: string) =>
  request<Enquiry>(`/enquiries/${id}/status`, {
    method: 'PUT',
    body: { status },
    errorMessage: 'Failed to update enquiry status',
  });

export const deleteEnquiry = (id: string) =>
  request<unknown>(`/enquiries/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete enquiry',
  });

export const fetchDashboardStats = () =>
  request<any>('/admin/dashboard', { errorMessage: 'Failed to fetch dashboard stats' });

export const fetchCustomers = () =>
  requestAllPages<any>('/admin/users', 'users', 'Failed to fetch customers');

export const updateUserRole = (userId: string, role: string) =>
  request<any>(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: { role },
    errorMessage: 'Failed to update user role',
  });
