import {
  BINDING_MONTHS,
  OfferSchema,
  type Offer,
  type PhoneTarget,
  type ProviderId,
} from "@mobilpriser/core";
import { extractJsonLd, extractStatedMinPrice, fetchHtml, findProductLd } from "../html.js";

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

      const statedMinPrice = extractStatedMinPrice(html);
      if (statedMinPrice == null) {
        return {
          offer: null,
          warning: `${label}: fandt ingen "mindstepris" på siden — parser eller side kan være ændret`,
        };
      }

      const product = findProductLd(extractJsonLd(html));

      const candidate: Offer = {
        id: `${id}:${ref.target.slug}`,
        provider: id,
        phone: ref.target,
        url: ref.url,
        statedMinPrice,
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
