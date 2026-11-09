import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { SITE_URL } from "@/lib/config";
import { HOME_TITLE, OPEN_GRAPH_DEFAULTS, SITE_NAME } from "@/lib/seo";
import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  // The optical-size axis gives large headings Inter's tighter display cut.
  axes: ["opsz"],
});

// Technical values only: SKUs, specifications, frequency bands.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Runs before first paint: flags that scripts are running, so intro-animated
 * elements can start hidden without ever hiding content from visitors whose
 * scripts don't run (see the [data-intro] rules in globals.css).
 */
const JS_FLAG = "document.documentElement.classList.add('js')";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // The template adds the brand to every page title, so pages pass theirs
  // without it. Never set `alternates.canonical` here: it would apply to every
  // page that doesn't set its own.
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Professional RFID products and inventory management solutions for modern enterprises. Tags, readers, antennas, and complete tracking systems.",
  keywords: [
    "RFID",
    "RFID tags",
    "RFID readers",
    "inventory management",
    "asset tracking",
    "supply chain",
    "UHF RFID",
  ],
  authors: [{ name: "Virtualsphere" }],
  openGraph: {
    ...OPEN_GRAPH_DEFAULTS,
    title: HOME_TITLE,
    description:
      "Professional RFID products and inventory management solutions for modern enterprises.",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description:
      "Professional RFID products and inventory management solutions for modern enterprises.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // The inline script below adds `js` to this element's classes before
      // React hydrates.
      suppressHydrationWarning
    >
      <GoogleTagManager gtmId="GTM-MJTFRDXL" />
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId="G-CS0VVTPQ0G" />
      <Script
        id="ga-extra-tags"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `gtag('config', 'G-7F6J4PE0LL'); gtag('config', 'AW-17705374623');`,
        }}
      />
    </html>
  );
}
