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

/**
 * En laveste pris, der ligger under denne andel af den næstlaveste,
 * regnes som en anden vare — brugt, parallelimporteret eller en anden
 * variant — frem for et udsalg.
 */
const OUTLIER_RATIO = 0.7;

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
  /** Kasserede priser og hvorfor. */
  warnings: string[];
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
  const warnings: string[] = [];

  const byPhone = new Map<string, RetailerPrice[]>();
  for (const price of prices) {
    byPhone.set(price.phoneSlug, [...(byPhone.get(price.phoneSlug) ?? []), price]);
  }

  for (const [phoneSlug, observations] of byPhone) {
    const sorted = [...observations].sort((a, b) => a.price - b.price);
    cashPriceCount[phoneSlug] = sorted.length;

    // En prissammenligning viser også brugte og parallelimporterede varer,
    // og deres laveste pris kan ligge langt under, hvad telefonen koster ny
    // i en dansk butik. Bruges den som reference, vender den dommen på
    // hvert eneste tilbud for telefonen.
    let chosen = sorted[0];
    while (
      sorted.length > 1 &&
      chosen === sorted[0] &&
      sorted[1].price > 0 &&
      sorted[0].price < sorted[1].price * OUTLIER_RATIO
    ) {
      warnings.push(
        `${phoneSlug}: kasserede ${sorted[0].price} kr. fra ${sorted[0].retailer}, ` +
          `som ligger langt under næstlaveste ${sorted[1].price} kr. fra ${sorted[1].retailer} — ` +
          `sandsynligvis en brugt eller anden variant`,
      );
      sorted.shift();
      chosen = sorted[0];
    }

    cashPrices[phoneSlug] = chosen.price;
    cashPriceSource[phoneSlug] = chosen.retailer;
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
    warnings,
  };
}
