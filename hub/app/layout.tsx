import type { Metadata } from "next";
import { Newsreader, Outfit } from "next/font/google";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-app-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-app-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Hub",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
