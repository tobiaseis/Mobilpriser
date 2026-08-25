import { BINDING_MONTHS } from "@mobilpriser/core";
import { pageText } from "./html.js";

/**
 * Udleder, hvad en mindstepris er sat sammen af, ud fra beløbene på siden.
 *
 * Alle udbyderne følger samme struktur: et beløb for telefonen plus seks
 * måneders abonnement, eventuelt med et lille gebyr oveni. Men de skriver
 * det forskelligt ("betal her og nu", "Alt om prisen", tabeller uden
 * ledetekst), så at lede efter ordlyd har allerede vist sig at fejle.
 *
 * I stedet bruges det ene tal, vi kan stole på: den mindstepris, udbyderen
 * selv oplyser. Et par (telefonbeløb, månedspris) accepteres kun hvis
 * begge tal står på siden OG regnestykket rammer mindsteprisen. Den
 * dobbelte betingelse er stram nok til, at et tilfældigt sammenfald er
 * usandsynligt — og den gør det umuligt at vise tal, der ikke går op.
 */

/** Rimeligt loft for en månedlig abonnementspris i kroner. */
const MAX_MONTHLY = 800;
/** Mindste beløb, der kan være en telefonpris. */
const MIN_PHONE = 300;
/** Oprettelse og fragt, som ikke altid står som selvstændige beløb. */
const MAX_UNEXPLAINED_FEES = 120;

const AMOUNT_ANYWHERE = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?\s*kr/gi;

export interface DerivedComponents {
  /** Beløbet for telefonen, betalt ved køb. */
  upfront: number;
  /** Abonnementets pris pr. måned. */
  planMonthly: number;
  /** Resten op til mindsteprisen — typisk oprettelse. */
  fees: number;
}

function amountsOnPage(text: string): number[] {
  const values = new Set<number>();
  AMOUNT_ANYWHERE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_ANYWHERE.exec(text)) !== null) {
    const value = Number(match[1].replace(/\./g, ""));
    if (Number.isFinite(value)) values.add(value);
  }
  return [...values];
}

/**
 * Returnerer null, når intet par går op. Det er med vilje: en tom kolonne
 * er ærlig, mens et gæt på hvad kunden betaler ved køb ikke er.
 */
export function deriveComponents(html: string, minPrice: number): DerivedComponents | null {
  const amounts = amountsOnPage(pageText(html));
  const monthlies = amounts.filter((a) => a > 0 && a <= MAX_MONTHLY);
  const upfronts = amounts.filter((a) => a >= MIN_PHONE && a <= minPrice);

  let best: DerivedComponents | null = null;

  for (const planMonthly of monthlies) {
    const subscription = planMonthly * BINDING_MONTHS;
    if (subscription > minPrice) continue;

    for (const upfront of upfronts) {
      const fees = minPrice - upfront - subscription;
      if (fees < 0 || fees > MAX_UNEXPLAINED_FEES) continue;

      // Ved flere mulige par vindes af det, der lader mindst uforklaret,
      // og derefter af den største telefonpris — et lille beløb ganget op
      // ville ellers kunne udgive sig for telefonen.
      if (
        !best ||
        fees < best.fees ||
        (fees === best.fees && upfront > best.upfront)
      ) {
        best = { upfront, planMonthly, fees };
      }
    }
  }

  return best;
}
