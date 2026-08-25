import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mobilpriser",
  description:
    "Sammenligning af mindsteprisen for 6 måneders binding på telefon med abonnement hos danske teleselskaber.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Mobilpriser
          </Link>
          <p className="tagline">Mindstepris for 6 mdr. binding, sammenlignet på tværs af udbydere</p>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            Priser hentes automatisk én gang i døgnet. Bekræft altid prisen hos udbyderen, før
            du bestiller — priser og kampagner kan ændre sig.
          </p>
        </footer>
      </body>
    </html>
  );
}
