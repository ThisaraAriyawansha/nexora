import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";

const siteUrl = "https://nexora-pos.vercel.app";
const ogImage = "/logo/5656477676.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nexora POS",
    template: "%s | Nexora POS",
  },
  description:
    "Nexora POS is a point of sale system built for computer and accessories stores, covering sales, inventory, customers, and warranty management.",
  keywords: [
    "Nexora POS",
    "point of sale",
    "POS system",
    "computer store POS",
    "inventory management",
    "sales management",
    "warranty management",
  ],
  applicationName: "Nexora POS",
  authors: [{ name: "Nexora" }],
  icons: {
    icon: "/logo/favicon_1.png",
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Nexora POS",
    title: "Nexora POS",
    description:
      "Point of Sale System for Computer & Accessories - manage sales, inventory, customers, and warranty in one place.",
    images: [
      {
        url: ogImage,
        width: 1254,
        height: 1254,
        alt: "Nexora POS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexora POS",
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
