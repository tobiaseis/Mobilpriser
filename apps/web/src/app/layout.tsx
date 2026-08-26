import type { Metadata } from "next";
import { Familjen_Grotesk, Newsreader } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { FreshnessPill, StaleAlert } from "./Freshness";
import { loadLatest } from "@/lib/data";
import "./globals.css";

/** Skandinavisk grotesk til navne, tal og knapper. */
const familjen = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  display: "swap",
});

/** Antikva til de afsnit, der forklarer regnestykket — sitet er en tekst
 *  lige så meget som en tabel, og skriften siger det. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mobilpriser — telefon med abonnement, uden regnestykket",
    template: "%s · Mobilpriser",
  },
  description:
    "Mindsteprisen for de seks måneders binding hos YouSee, Telenor, Telmore, CBB, Call me, Norlys og 3 — stillet op mod, hvad telefonen koster, hvis du bare køber den.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const latest = loadLatest();

  return (
    <html lang="da" className={`${familjen.variable} ${newsreader.variable}`}>
      <body>
        <header className="topbar">
          <div className="shell topbar-inner">
            <Link href="/" className="brand">
              Mobilpriser
            </Link>
            <FreshnessPill generatedAt={latest.generatedAt} />
          </div>
        </header>

        <StaleAlert generatedAt={latest.generatedAt} builtAt={process.env.BUILD_TIME ?? null} />

        <main>
          <div className="shell">{children}</div>
        </main>

        <footer className="site-footer">
          <div className="shell">
            <p>
              Priserne hentes automatisk én gang i døgnet fra udbydernes egne produktsider.
              Bekræft prisen hos udbyderen, før du bestiller — kampagner skifter hurtigere,
              end vi henter.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
