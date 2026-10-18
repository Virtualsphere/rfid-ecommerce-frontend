import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const context = (pin: string) => ({ params: Promise.resolve({ pin }) });
const lookup = (pin: string) => GET(new Request(`http://localhost:3000/api/pincode/${pin}`), context(pin));

function upstream(body: unknown, status = 200) {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("PIN code route", () => {
  it("returns the post offices from India Post's HTTPS API", async () => {
    const fetchMock = upstream([
      {
        Status: "Success",
        PostOffice: [{ Name: "Connaught Place", District: "Central Delhi", State: "Delhi" }],
      },
    ]);

    const response = await lookup("110001");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.postalpincode.in/pincode/110001");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pincode: "110001",
      postOffices: [{ name: "Connaught Place", district: "Central Delhi", state: "Delhi" }],
    });
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("answers 404 for a PIN code with no post office, and caches that too", async () => {
    upstream([{ Message: "No records found", Status: "Error", PostOffice: null }]);
    const response = await lookup("999999");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("max-age");
  });

  it.each(["11000", "011001", "abcdef", "1100011"])("refuses %j without calling India Post", async (pin) => {
    const fetchMock = upstream([]);
    const response = await lookup(pin);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502, uncached, when India Post is unreachable", async () => {
    quiet();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const response = await lookup("110001");
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 502 when India Post errors or answers something unrecognisable", async () => {
    quiet();
    upstream({ error: "busy" }, 503);
    expect((await lookup("110001")).status).toBe(502);

    upstream({ unexpected: true });
    expect((await lookup("110001")).status).toBe(502);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Runtime Error</html>")));
    expect((await lookup("110001")).status).toBe(502);
  });
});
