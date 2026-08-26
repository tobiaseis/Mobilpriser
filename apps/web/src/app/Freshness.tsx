"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatDayMonth } from "@/lib/format";

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

/**
 * Alderen udregnes én gang og huskes.
 *
 * React spørger getSnapshot både under gengivelsen og igen bagefter for at
 * kontrollere, at svaret holdt sig i ro, og både mærket i toplinjen og
 * båndet nedenunder spørger hver for sig. Uden det her ville hver af de
 * fire forespørgsler aflæse uret på ny — og falder timeskiftet midt
 * imellem to af dem, får React to forskellige svar på det samme spørgsmål.
 */
let ageSnapshot: { iso: string | null; hours: number | null } | null = null;

function hoursOldSnapshot(iso: string | null): number | null {
  if (ageSnapshot === null || ageSnapshot.iso !== iso) {
    ageSnapshot = { iso, hours: ageInWholeHours(iso) };
  }
  return ageSnapshot.hours;
}

/** Serveren kender ikke den besøgendes ur og svarer null. */
const onServer = () => null;

/**
 * Serveren kender ikke den besøgendes ur og svarer null, så den byggede
 * HTML aldrig indeholder en advarsel, der er forældet i samme øjeblik.
 */
function useHoursOld(generatedAt: string | null): number | null {
  return useSyncExternalStore(
    noSubscription,
    () => hoursOldSnapshot(generatedAt),
    onServer,
  );
}

/** Mærket i toplinjen: hvor gamle priserne på siden er lige nu. */
export function FreshnessPill({ generatedAt }: { generatedAt: string | null }) {
  const hoursOld = useHoursOld(generatedAt);
  const stale = hoursOld != null && hoursOld > STALE_AFTER_HOURS;

  return (
    <span className="freshness" data-stale={stale}>
      <span className="freshness-dot" aria-hidden="true" />
      <span className="freshness-label">Priser hentet</span>
      <span>{describeAge(hoursOld, generatedAt)}</span>
    </span>
  );
}

function describeAge(hoursOld: number | null, generatedAt: string | null): string {
  if (generatedAt == null) return "endnu ikke";
  // Før hydrering kender vi ikke den besøgendes ur, så datoen står tør.
  if (hoursOld == null) return formatDayMonth(generatedAt);
  if (hoursOld < 1) return "for lidt siden";
  if (hoursOld < 24) return `for ${hoursOld} ${hoursOld === 1 ? "time" : "timer"} siden`;
  const days = Math.floor(hoursOld / 24);
  return `for ${days} ${days === 1 ? "døgn" : "døgn"} siden`;
}

/** Båndet under toplinjen, når tallene er gamle nok til at være forkerte. */
export function StaleAlert({
  generatedAt,
  builtAt,
}: {
  generatedAt: string | null;
  builtAt: string | null;
}) {
  const hoursOld = useHoursOld(generatedAt);
  if (hoursOld == null || hoursOld <= STALE_AFTER_HOURS) return null;

  return (
    <div className="notice notice-band">
      <div className="shell">
        Priserne er <strong>{Math.floor(hoursOld / 24)} døgn gamle</strong>. Enten er den
        daglige kørsel ikke gennemført, eller også er sitet ikke bygget om siden. Sitet blev
        bygget {formatDate(builtAt)} — er det tidspunkt lige så gammelt, mangler bygningen;
        er det nyt, er det kørslen.
      </div>
    </div>
  );
}
