import { isPincode, parsePostOffices } from "@/lib/pincode";

type Context = { params: Promise<{ pin: string }> };

/**
 * India Post's PIN code directory (postalpincode.in). Its documented address
 * is HTTPS; the http://www.postalpincode.in form couldn't be called from this
 * site's HTTPS pages at all, as browsers block it as mixed content.
 */
const UPSTREAM = "https://api.postalpincode.in/pincode/";

/** The service usually answers in about a second. */
const TIMEOUT_MS = 8_000;

/**
 * PIN codes almost never change, so an answer may be reused for a day by the
 * browser and a week by the CDN. Only real answers are cached; a failed lookup
 * is retried on the next request.
 */
const CACHED = { "Cache-Control": "public, max-age=86400, s-maxage=604800" };
const UNCACHED = { "Cache-Control": "no-store" };

/**
 * The post offices for a PIN code, for the checkout's address form.
 *
 * Looked up here rather than from the browser because the service sends no
 * CORS headers, and so the checkout depends only on this app's own origin.
 *
 *   200 { pincode, postOffices: [{ name, district, state }] }
 *   400 not a PIN code · 404 no such PIN code · 502 lookup unavailable
 */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { pin } = await params;
  if (!isPincode(pin)) {
    return Response.json({ message: "A PIN code is six digits." }, { status: 400, headers: CACHED });
  }

  let postOffices;
  try {
    const response = await fetch(UPSTREAM + pin, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    postOffices = parsePostOffices(await response.json());
    if (!postOffices) throw new Error("Unrecognised response");
  } catch (error) {
    console.error(`PIN code lookup for ${pin} failed:`, error);
    return Response.json(
      { message: "PIN code lookup is unavailable right now." },
      { status: 502, headers: UNCACHED }
    );
  }

  if (postOffices.length === 0) {
    return Response.json({ message: "No post office has this PIN code." }, { status: 404, headers: CACHED });
  }
  return Response.json({ pincode: pin, postOffices }, { headers: CACHED });
}
