"use client";

import { useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format";

/**
 * Den daglige kørsel er ikke det samme som en ny udgave af sitet: priserne
 * committes til data/, og først når Vercel bygger om, kommer de på siden.
 * Sker den bygning ikke, står gamle tal tilbage og ser lige så rigtige ud
 * som nye.
 *
 * Alderen udregnes derfor i browseren mod den besøgendes ur, ikke ved
 * bygningen. Et tal udregnet ved bygningen ville stå stille sammen med
 * resten af siden og aldrig kunne opdage netop den fejl, det er sat til at
 * fange.
 *
 * 30 timer: kørslen er daglig, så et døgn er normalt. Margenen er til en
 * kørsel, der starter sent eller tager længere end sædvanligt.
 */
const STALE_AFTER_HOURS = 30;

/** Alderen ændrer sig ikke, mens siden er åben, så der er intet at abonnere på. */
const noSubscription = () => () => {};

/**
 * Hele timer, ikke brøkdele: React sammenligner det, den får her, fra
 * gengivelse til gengivelse, og et tal der ændrer sig ved hvert opslag
 * ville sætte den i ring.
 */
function ageInWholeHours(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 3_600_000);
}

export function Freshness({
  generatedAt,
  builtAt,
}: {
  generatedAt: string | null;
  builtAt: string | null;
}) {
  // Serveren kender ikke den besøgendes ur og svarer null, så den byggede
  // HTML aldrig indeholder en advarsel, der er forældet i samme øjeblik.
  const hoursOld = useSyncExternalStore(
    noSubscription,
    () => ageInWholeHours(generatedAt),
    () => null,
  );

  const stale = hoursOld != null && hoursOld > STALE_AFTER_HOURS;

  return (
    <>
      <p className="meta-line">
        Priser hentet: {formatDate(generatedAt)}
        {builtAt && <> · sitet bygget: {formatDate(builtAt)}</>}
      </p>
      {stale && (
        <div className="warning-box">
          Priserne er <strong>{Math.floor(hoursOld / 24)} døgn gamle</strong>. Enten er den
          daglige kørsel ikke gennemført, eller også er sitet ikke bygget om siden. Står der
          et lige så gammelt tidspunkt ved &quot;sitet bygget&quot;, er det bygningen der
          mangler; er det nyt, er det kørslen.
        </div>
      )}
    </>
  );
}
