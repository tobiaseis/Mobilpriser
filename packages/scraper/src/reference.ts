import type { Offer } from "@mobilpriser/core";
import { pageText } from "./html.js";

/**
 * Referencen for "er det faktisk billigt": hvad det koster at købe
 * telefonen kontant og tage et billigt abonnement ved siden af.
 *
 * Tallene skrives ikke i hånden. En håndskrevet kontantpris ser rigtig ud
 * for evigt og bliver forældet i stilhed, og hele pointen med projektet er
 * at følge priser, der bevæger sig. I stedet samles de op fra de sider, vi
 * alligevel henter: flere udbydere oplyser telefonens pris uden abonnement,
 * og OiSTER kalder den ligefrem "kontantpris".
 */

/** Kun beløb med en utvetydig etiket accepteres som kontantpris. */
const CASH_PRICE_PATTERN =
  /(?:kontantpris|uden abonnement|normalpris)[\s\S]{0,40}?(\d{1,3}(?:\.\d{3})+|\d{4,})\s*kr/gi;

const MIN_CASH = 1000;
const MAX_CASH = 30000;

export function extractCashPrice(html: string): number | null {
  const text = pageText(html);
  CASH_PRICE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CASH_PRICE_PATTERN.exec(text)) !== null) {
    const value = Number(match[1].replace(/\./g, ""));
    if (Number.isFinite(value) && value >= MIN_CASH && value <= MAX_CASH) {
      return value;
    }
  }
  return null;
}

export interface ReferenceData {
  generatedAt: string;
  /** Laveste oplyste kontantpris pr. telefon, på tværs af udbydere. */
  cashPrices: Record<string, number>;
  /** Laveste månedspris set på tværs af alle tilbud. */
  cheapestMonthly: number | null;
  /** Hvor mange udbydere hver kontantpris bygger på. */
  cashPriceSources: Record<string, number>;
}

export interface CashPriceObservation {
  phoneSlug: string;
  cashPrice: number;
}

/**
 * Samler observationerne til én reference.
 *
 * Den laveste oplyste kontantpris vinder: referencen skal svare på "kunne
 * jeg gøre det billigere selv", og så er det den bedste pris, man realistisk
 * kan finde, der er den ærlige målestok — ikke et gennemsnit af udbydere,
 * der hver især lægger noget oveni.
 */
export function buildReference(
  observations: CashPriceObservation[],
  offers: Offer[],
): ReferenceData {
  const cashPrices: Record<string, number> = {};
  const cashPriceSources: Record<string, number> = {};

  for (const { phoneSlug, cashPrice } of observations) {
    cashPriceSources[phoneSlug] = (cashPriceSources[phoneSlug] ?? 0) + 1;
    const current = cashPrices[phoneSlug];
    if (current == null || cashPrice < current) {
      cashPrices[phoneSlug] = cashPrice;
    }
  }

  const monthlies = offers
    .map((offer) => offer.components.planMonthly)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    generatedAt: new Date().toISOString(),
    cashPrices,
    cheapestMonthly: monthlies.length > 0 ? Math.min(...monthlies) : null,
    cashPriceSources,
  };
}
