import { indianMobile } from "./phone";
import { isPincode, type PincodeLookup, type PostOffice } from "./pincode";

/** The checkout's delivery details, field by field. We only deliver within India. */
export type ShippingAddress = {
  /** Who receives the parcel; starts as the account's name. */
  fullName: string;
  /** A mobile number for the courier, in whatever form it was typed. */
  phone: string;
  pincode: string;
  /** The post office picked from the PIN code's list, which names the locality. */
  locality: string;
  /** Flat, house number, building, company. */
  line1: string;
  /** Area, street, sector, village. */
  line2: string;
  landmark: string;
  city: string;
  state: string;
};

export const emptyShippingAddress = (fullName = ""): ShippingAddress => ({
  fullName,
  phone: "",
  pincode: "",
  locality: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
});

/** Where the PIN code's lookup stands: idle until all six digits are in. */
export type PincodeStatus = "idle" | "loading" | PincodeLookup["status"];

const mostCommon = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/**
 * Fills locality, city and state from the post offices of a PIN code that was
 * just looked up. A lone office is picked outright. With several, the locality
 * is left for the customer to choose and the city is the district most of them
 * share (110001 lists offices in both "Central Delhi" and "New Delhi"). A
 * locality already chosen is kept if the new list still has it.
 */
export function applyPostOffices(address: ShippingAddress, offices: PostOffice[]): ShippingAddress {
  const office = offices.find((o) => o.name === address.locality) ?? (offices.length === 1 ? offices[0] : undefined);
  return {
    ...address,
    locality: office?.name ?? "",
    city: office?.district || mostCommon(offices.map((o) => o.district)) || address.city,
    state: office?.state ?? offices[0]?.state ?? address.state,
  };
}

export type AddressProblem = { field: keyof ShippingAddress; message: string };

/**
 * The first thing stopping `address` from being shipped to, in the order the
 * fields appear, or null when it's complete.
 *
 * A PIN code India Post doesn't know is refused. One that couldn't be checked
 * because the lookup service is down is let through, with city and state typed
 * by hand, so an outage elsewhere never blocks a sale.
 */
export function shippingAddressProblem(
  address: ShippingAddress,
  pincode: { status: PincodeStatus; postOffices: PostOffice[] }
): AddressProblem | null {
  const blank = (field: keyof ShippingAddress) => !address[field].trim();

  if (blank("fullName")) return { field: "fullName", message: "Please enter the recipient's full name." };
  if (!indianMobile(address.phone)) return { field: "phone", message: "Please enter a 10-digit mobile number." };
  if (!isPincode(address.pincode.trim())) return { field: "pincode", message: "Please enter a 6-digit PIN code." };
  if (pincode.status === "loading" || pincode.status === "idle") {
    return { field: "pincode", message: "Still checking your PIN code. Please try again in a moment." };
  }
  if (pincode.status === "not-found") {
    return { field: "pincode", message: "We couldn't find that PIN code. Please check it." };
  }
  if (pincode.status === "found" && !pincode.postOffices.some((o) => o.name === address.locality)) {
    return { field: "locality", message: "Please choose your locality." };
  }
  if (blank("line1")) return { field: "line1", message: "Please enter your flat, house number or building." };
  if (blank("line2")) return { field: "line2", message: "Please enter your area or street." };
  if (blank("city")) return { field: "city", message: "Please enter your city." };
  if (blank("state")) return { field: "state", message: "Please enter your state." };
  return null;
}

/**
 * The address as the block of lines a parcel label needs. Orders store the
 * address as one string, so this is what the admin panel and the order
 * confirmation show.
 *
 *   Rahul Sharma
 *   Flat 4B, Sunrise Apartments
 *   MG Road
 *   Landmark: Near Regal Cinema
 *   Connaught Place, Central Delhi
 *   Delhi 110001
 *   India
 */
export function formatShippingAddress(address: ShippingAddress): string {
  const field = (name: keyof ShippingAddress) => address[name].trim().replace(/\s+/g, " ");
  const city = field("city");
  const locality = field("locality");
  const area = locality && locality.toLowerCase() !== city.toLowerCase() ? `${locality}, ${city}` : city;

  return [
    field("fullName"),
    field("line1"),
    field("line2"),
    field("landmark") && `Landmark: ${field("landmark")}`,
    area,
    `${field("state")} ${field("pincode")}`,
    "India",
  ]
    .filter(Boolean)
    .join("\n");
}
