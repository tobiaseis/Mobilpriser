import {
  BINDING_MONTHS,
  OfferSchema,
  type Offer,
  type PhoneTarget,
  type ProviderId,
} from "@mobilpriser/core";
import {
  extractJsonLd,
  fetchHtml,
  findMinPriceCandidates,
  findProductLd,
  isPlausibleMinPrice,
} from "../html.js";

export interface ProductRef {
  target: PhoneTarget;
  url: string;
}

export interface ScrapeResult {
  offer: Offer | null;
  /** Sat når intet tilbud blev udtrukket — vises i kørslens Actions-summary. */
  warning?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  /** Rene URL-opslag ud fra config — ingen netværkskald. */
  discover(targets: PhoneTarget[]): ProductRef[];
  scrape(ref: ProductRef): Promise<ScrapeResult>;
}

/**
 * Fælles adapter for alle udbydere. Kernen i indsamlingen er, at danske
 * forbrugerabonnementer med binding er lovpligtigt at mærke med en
 * "mindstepris" — det tal er langt mere robust at lede efter end
 * udbyder-specifik markup, og det er præcis det tal, sammenligningen skal
 * rangere på. JSON-LD bruges kun til at hæve konfidensen, når den findes.
 */
export function createGenericAdapter(
  id: ProviderId,
  urlsBySlug: Record<string, string>,
): ProviderAdapter {
  return {
    id,

    discover(targets) {
      return targets
        .filter((target) => Boolean(urlsBySlug[target.slug]))
        .map((target) => ({ target, url: urlsBySlug[target.slug] }));
    },

    async scrape(ref) {
      const label = `${id}/${ref.target.slug}`;
      let html: string;
      try {
        html = await fetchHtml(ref.url);
      } catch (err) {
        return {
          offer: null,
          warning: `${label}: kunne ikke hente siden (${(err as Error).message})`,
        };
      }

      // Alle beløb nær ordet "mindstepris" hentes, ikke bare det første, så
      // en advarsel kan fortælle præcis hvad der stod på siden. Uden det er
      // en fejlende parser umulig at rette uden selv at kunne åbne siden.
      const candidates = findMinPriceCandidates(html);
      const chosen = candidates.find((c) => !c.perMonth && isPlausibleMinPrice(c.value));

      if (!chosen) {
        return { offer: null, warning: `${label}: ${describeFailure(candidates)}` };
      }

      const product = findProductLd(extractJsonLd(html));

      const candidate: Offer = {
        id: `${id}:${ref.target.slug}`,
        provider: id,
        phone: ref.target,
        url: ref.url,
        statedMinPrice: chosen.value,
        components: {},
        computedMinPrice: null,
        bindingMonths: BINDING_MONTHS,
        scrapedAt: new Date().toISOString(),
        source: "text-pattern",
        confidence: product ? "medium" : "low",
      };

      const parsed = OfferSchema.safeParse(candidate);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return { offer: null, warning: `${label}: tilbud fejlede validering (${issues})` };
      }

      return { offer: parsed.data };
    },
  };
}

/**
 * Forklarer hvorfor ingen mindstepris blev valgt, med de tal der faktisk
 * stod på siden. Advarslen ender i kørslens summary, så den er ofte det
 * eneste, der er til rådighed, når en parser skal rettes.
 */
function describeFailure(candidates: ReturnType<typeof findMinPriceCandidates>): string {
  if (candidates.length === 0) {
    return 'fandt ingen "mindstepris" på siden — enten er ordlyden en anden, eller også indlæses prisen med JavaScript';
  }
  const described = candidates
    .slice(0, 5)
    .map((c) => `${c.value} kr.${c.perMonth ? " (pr. md.)" : ""}`)
    .join(", ");
  const context = candidates[0].context;
  return `fandt "mindstepris", men intet brugbart beløb — kandidater: ${described}. Kontekst: "${context}"`;
}
