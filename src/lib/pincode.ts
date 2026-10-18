/** An Indian PIN code: six digits, never starting with 0. */
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const isPincode = (value: string) => PINCODE_PATTERN.test(value);

/** One post office serving a PIN code, as India Post lists it. */
export type PostOffice = {
  /** The post office's name, which is also the locality it serves ("Connaught Place"). */
  name: string;
  district: string;
  state: string;
};

/** What a PIN code lookup can come back with. */
export type PincodeLookup =
  | { status: "found"; postOffices: PostOffice[] }
  /** India Post has no post office under this PIN code: it is mistyped. */
  | { status: "not-found" }
  /** The lookup service couldn't be reached or answered nonsense. */
  | { status: "unavailable" };

/**
 * The post offices in a response from api.postalpincode.in, or null when the
 * response isn't one that service sends.
 *
 * Its answer is a one-element array. A known PIN code comes back as
 * `{ Status: "Success", PostOffice: [...] }`, an unknown one as
 * `{ Status: "Error", Message: "No records found", PostOffice: null }`, which
 * this returns as an empty list. Names carry stray trailing spaces
 * ("New Delhi "), and a PIN code can list the same office twice.
 */
export function parsePostOffices(body: unknown): PostOffice[] | null {
  const result = Array.isArray(body) ? body[0] : undefined;
  if (!result || typeof result !== "object") return null;
  const { Status, PostOffice } = result as { Status?: unknown; PostOffice?: unknown };

  if (Status === "Error") return [];
  if (Status !== "Success" || !Array.isArray(PostOffice)) return null;

  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const byName = new Map<string, PostOffice>();
  for (const office of PostOffice) {
    const name = text(office?.Name);
    const state = text(office?.State);
    if (!name || !state || byName.has(name)) continue;
    byName.set(name, { name, district: text(office?.District), state });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Looks a PIN code up through this app's /api/pincode route. Browser only. */
export async function lookupPincode(pincode: string, signal?: AbortSignal): Promise<PincodeLookup> {
  let response: Response;
  try {
    response = await fetch(`/api/pincode/${pincode}`, { signal });
  } catch (error) {
    // A superseded lookup is the caller's doing, not an outage.
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }

  if (response.status === 404) return { status: "not-found" };
  if (!response.ok) return { status: "unavailable" };
  try {
    const { postOffices } = (await response.json()) as { postOffices?: PostOffice[] };
    return postOffices?.length ? { status: "found", postOffices } : { status: "not-found" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
}
