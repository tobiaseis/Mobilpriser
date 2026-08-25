import { BINDING_MONTHS } from "./types.js";
import type { OfferComponents, Verdict } from "./types.js";

/** Krydstjek regnes som brudt, hvis afvigelsen er større end dette (kr.). */
export const CROSS_CHECK_TOLERANCE_KR = 50;

/** Under/over referencen med mindre end dette regnes som "neutral" (kr.). */
export const VERDICT_NEUTRAL_BAND_KR = 300;

/**
 * Abonnementsomkostning over de 6 måneders binding, med kampagnepris i de
 * første `campaignMonths` måneder og normalpris resten af perioden.
 */
export function subscriptionCostOverBinding(
  components: Pick<OfferComponents, "planMonthly" | "campaignMonthly" | "campaignMonths">,
): number | null {
  const { planMonthly, campaignMonthly, campaignMonths } = components;
  if (planMonthly == null) return null;

  let total = 0;
  for (let month = 1; month <= BINDING_MONTHS; month++) {
    const campaignActive =
      campaignMonths != null && campaignMonthly != null && month <= campaignMonths;
    total += campaignActive ? campaignMonthly : planMonthly;
  }
  return total;
}

/**
 * Regner mindsteprisen ud fra komponenterne — bruges udelukkende til
 * krydstjek mod udbyderens eget oplyste tal, aldrig som selve tallet
 * sammenligningen rangerer på.
 *
 * Returnerer null, hvis der mangler for mange komponenter til at kunne
 * regne et meningsfuldt tal (fx planMonthly eller deviceMonthly ukendt).
 */
export function computeMinPriceFromComponents(
  components: OfferComponents,
): number | null {
  const subscription = subscriptionCostOverBinding(components);
  if (subscription == null || components.deviceMonthly == null) return null;

  const upfront = components.upfront ?? 0;
  const setupFee = components.setupFee ?? 0;
  const shippingFee = components.shippingFee ?? 0;

  return (
    upfront +
    setupFee +
    shippingFee +
    components.deviceMonthly * BINDING_MONTHS +
    subscription
  );
}

/**
 * Afvigelse mellem det selvberegnede tal og udbyderens oplyste mindstepris.
 * Positiv betyder, at vores beregning lander højere end det oplyste tal.
 * Returnerer null, hvis der ikke er nok komponenter til at beregne noget.
 */
export function crossCheckDeltaKr(
  statedMinPrice: number,
  components: OfferComponents,
): number | null {
  const computed = computeMinPriceFromComponents(components);
  if (computed == null) return null;
  return Math.round(computed - statedMinPrice);
}

export function crossCheckPasses(deltaKr: number | null): boolean {
  return deltaKr == null || Math.abs(deltaKr) <= CROSS_CHECK_TOLERANCE_KR;
}

/** Reference: køb telefonen kontant + billigste SIM-only i 6 måneder. */
export function calculateReference(
  cashPrice: number,
  cheapestSimOnlyMonthly: number,
): number {
  return cashPrice + cheapestSimOnlyMonthly * BINDING_MONTHS;
}

/**
 * 🟢 under referencen, 🟡 inden for ±300 kr., 🔴 over referencen.
 */
export function verdictFor(statedMinPrice: number, reference: number): Verdict {
  const diff = statedMinPrice - reference;
  if (diff < -VERDICT_NEUTRAL_BAND_KR) return "good";
  if (diff > VERDICT_NEUTRAL_BAND_KR) return "bad";
  return "neutral";
}
