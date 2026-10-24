import { SITE_URL } from "./config";

export const SITE_CONFIG = {
  name: "Virtualsphere",
  tagline: "Enterprise RFID Solutions",
  description:
    "Professional RFID products and inventory management solutions for modern enterprises. Tags, readers, antennas, and complete tracking systems.",
  url: SITE_URL,
  email: "info@virtualspheretechnologies.in",
  /** The office's mobile line; it is also the number people ring and message. */
  phone: "+91-7050506400",
  /** A second line for calls, shown beside `phone` in the footer and on the contact page. */
  phoneSecondary: "+91-8287635245",
  /** Support site: reader SDKs, drivers and datasheets. */
  resourcesUrl: "https://resource.indiarfidshop.com",
  /**
   * WhatsApp number, international format. ⚠ REVIEW: assumed to be the same
   * mobile as `phone`; change it here if WhatsApp runs on a different number.
   */
  whatsapp: "+91-7050506400",
  /**
   * Where customers ask for reader SDKs, drivers and datasheets.
   * ⚠ REVIEW: the domain is assumed to match the company email above.
   */
  sdkEmail: "resources.info@virtualspheretechnologies.in",
  address: {
    street: "3rd Floor, D-318, D Block, Sector 10",
    city: "Noida",
    state: "Uttar Pradesh",
    zip: "201301",
    country: "India",
  },
  /** Google Maps listing for the office; every shown address links here. */
  mapUrl: "https://maps.app.goo.gl/MsitHJVVx1vGh2uL7",
  /** The pin from that listing, for the contact page's embedded map. */
  mapCoordinates: "28.5925309,77.3330815",
  social: {
    twitter: "https://twitter.com/indiarfidshop",
    linkedin: "https://linkedin.com/company/indiarfidshop",
    github: "https://github.com/indiarfidshop",
  },
} as const;

/** A wa.me chat link to the shop's WhatsApp number, optionally with a first message filled in. */
export function whatsappUrl(message?: string): string {
  const digits = SITE_CONFIG.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** A mailto: link to the SDK/resources mailbox with the request's subject filled in. */
export function sdkRequestUrl(subject: string, body?: string): string {
  const query = `subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
  return `mailto:${SITE_CONFIG.sdkEmail}?${query}`;
}

export const NAV_ITEMS = [
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/categories" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

/** Legal and policy pages: the footer's bottom bar and each policy page's "other policies" list. */
export const POLICY_LINKS = [
  { label: "Terms & conditions", href: "/terms" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Return & refund policy", href: "/returns" },
  { label: "Shipping & delivery policy", href: "/shipping" },
] as const;

export const ADMIN_NAV = {
  overview: [
    { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
    { label: "Analytics", href: "/admin/analytics", icon: "BarChart3" },
  ],
  commerce: [
    { label: "Products", href: "/admin/products", icon: "Package" },
    { label: "Orders", href: "/admin/orders", icon: "ShoppingCart" },
    { label: "Inventory", href: "/admin/inventory", icon: "Warehouse" },
    { label: "Customers", href: "/admin/customers", icon: "Users" },
  ],
  settings: [
    { label: "SEO", href: "/admin/seo", icon: "Search" },
    { label: "Settings", href: "/admin/settings", icon: "Settings" },
  ],
} as const;

/**
 * The footer's category links, in catalog order. These are fixed text, so
 * keep them in step with the category names in the admin panel.
 */
export const PRODUCT_CATEGORIES = [
  "Integrated Reader",
  "Four Port Reader",
  "Eight Port Reader",
  "RFID UHF Antenna",
  "Handheld Reader",
  "UHF Desktop Reader",
  "HF RFID Desktop Reader",
  "RFID LF and HF Pendrive Reader",
] as const;

/**
 * Home page merchandising, by product slug: the hero rotation (in this order,
 * up to five) and the four showcase sheets. The showcase was chosen for range
 * (integrated, handheld, four-port, antenna, desktop) and because their photos
 * are high-resolution shots on white, which the product plate needs — VSL-A1,
 * UDR 105 and PVR 3 are shot on black and UHR 72 on grey, so they show as
 * boxes. Any slug that's disabled or out of stock is replaced automatically
 * (see curateHome). A product pinned in both lists shows in both.
 *
 * Hero, as requested: UDT9R, UDM9R, UHR 2, UDM12R, UDR 105.
 * Showcase, as requested: UHR2, UDM12R, VSL-F2, UDR-W101.
 */
export const HOME_FEATURED = {
  heroSlides: [
    "udt9r-rfid-jewellery-tray-reader",
    "udm9r-Integrated-reader",
    "uhr2-uhf-rfid-handheld-reader",
    "udm12r-uhf-Integrated-reader",
    "udr-w105-uhf-rfid-desktop-reader-writer",
  ],
  showcase: [
    "uhr2-uhf-rfid-handheld-reader",
    "udm12r-uhf-Integrated-reader",
    "vsl-f2-uhf-rfid-4-port-reader",
    "udr-w101-uhf-rfid-desktop-reader-writer",
  ],
};

/**
 * How prices relate to GST, shown beside every price.
 * ⚠ REVIEW: the cart doesn't calculate GST and no product records a rate, so
 * this wording is a neutral placeholder — confirm whether list prices include
 * GST and say so exactly (e.g. "Excl. 18% GST").
 */
export const GST_NOTE = "GST as applicable";
