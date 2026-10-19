import type { Metadata, Viewport } from "next";
import { Amiri, Instrument_Sans } from "next/font/google";
import "./globals.css";

const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-amiri", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Quran Reader",
  description: "Read the Quran and its Urdu tafseer page by page, on any device.",
};

export const viewport: Viewport = { themeColor: "#103A2D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${amiri.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
