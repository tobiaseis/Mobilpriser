import type { Offer } from "@mobilpriser/core";
import type { RetailerPrice } from "./retailers.js";

/**
 * Referencen for "er det faktisk billigt": hvad det koster at købe
 * telefonen hos en forhandler og tage et billigt abonnement ved siden af.
 *
 * Kilden er forhandlere — Elgiganten, POWER, Proshop — og ikke
 * teleudbyderne selv. En udbyders egen kontantpris er ikke en markedspris:
 * den ligger typisk over detailhandlens, og bruges den som målestok, kommer
 * ethvert abonnementstilbud til at se bedre ud, end det er. Forskellen er
 * ikke akademisk: Proshop havde iPhone 17 til 6.666 kr., mens YouSees pris
 * uden abonnement stod til 7.499 kr.
 *
 * Tallene skrives ikke i hånden. En håndskrevet pris ser rigtig ud for
 * evigt og bliver forældet i stilhed, og hele pointen med projektet er at
 * følge priser, der bevæger sig.
 */

export interface ReferenceData {
  generatedAt: string;
  /** Laveste forhandlerpris pr. telefon. */
  cashPrices: Record<string, number>;
  /** Hvilken forhandler den laveste pris kom fra. */
  cashPriceSource: Record<string, string>;
  /** Hvor mange forhandlere prisen bygger på. */
  cashPriceCount: Record<string, number>;
  /** Laveste månedspris set blandt de sammenlignede tilbud. */
  cheapestMonthly: number | null;
}

/**
 * Den laveste forhandlerpris vinder: referencen skal svare på "kunne jeg
 * gøre det billigere selv", og så er det den bedste pris, man realistisk
 * kan finde, der er den ærlige målestok.
 */
export function buildReference(prices: RetailerPrice[], offers: Offer[]): ReferenceData {
  const cashPrices: Record<string, number> = {};
  const cashPriceSource: Record<string, string> = {};
  const cashPriceCount: Record<string, number> = {};

  for (const { phoneSlug, price, retailer } of prices) {
    cashPriceCount[phoneSlug] = (cashPriceCount[phoneSlug] ?? 0) + 1;
    const current = cashPrices[phoneSlug];
    if (current == null || price < current) {
      cashPrices[phoneSlug] = price;
      cashPriceSource[phoneSlug] = retailer;
    }
  }

  // Bemærk: dette er den laveste månedspris blandt de tilbud, vi
  // sammenligner — ikke markedets billigste SIM-only. Det er en
  // konservativ målestok, fordi et billigere abonnement udefra kun ville
  // gøre referencen lavere og dermed dommen hårdere.
  const monthlies = offers
    .map((offer) => offer.components.planMonthly)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    generatedAt: new Date().toISOString(),
    cashPrices,
    cashPriceSource,
    cashPriceCount,
    cheapestMonthly: monthlies.length > 0 ? Math.min(...monthlies) : null,
  };
}
