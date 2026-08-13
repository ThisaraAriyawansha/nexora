import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";

const siteUrl = "https://nexora-pos.vercel.app";
const ogImage = "/shop_logo/og_image.jpeg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "T&N COMPUTERS POS",
    template: "%s | T&N COMPUTERS POS",
  },
  description:
    "T&N COMPUTERS POS is a point of sale system built for computer and accessories stores, covering sales, inventory, customers, and warranty management.",
  keywords: [
    "T&N COMPUTERS POS",
    "point of sale",
    "POS system",
    "computer store POS",
    "inventory management",
    "sales management",
    "warranty management",
  ],
  applicationName: "T&N COMPUTERS POS",
  authors: [{ name: "T&N COMPUTERS" }],
  icons: {
    icon: "/shop_logo/6767467478-removebg-preview.png",
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "T&N COMPUTERS POS",
    title: "T&N COMPUTERS POS",
    description:
      "Point of Sale System for Computer & Accessories - manage sales, inventory, customers, and warranty in one place.",
    images: [
      {
        url: ogImage,
        width: 1119,
        height: 1280,
        alt: "T&N COMPUTERS POS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "T&N COMPUTERS POS",
    description:
      "Point of Sale System for Computer & Accessories — manage sales, inventory, customers, and warranty in one place.",
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
