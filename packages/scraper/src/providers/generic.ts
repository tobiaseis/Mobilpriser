import {
  BINDING_MONTHS,
  OfferSchema,
  type Offer,
  type PhoneTarget,
  type ProviderId,
} from "@mobilpriser/core";
import { fetchRenderedHtml } from "../browser.js";
import {
  extractJsonLd,
  fetchHtml as defaultFetchHtml,
  findMinPriceCandidates,
  findProductLd,
  isPlausibleMinPrice,
  looksClientRendered,
  looksOutOfStock,
  type MinPriceCandidate,
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

/**
 * Hentning og browser-gengivelse kan udskiftes, så adapterens logik kan
 * testes uden netværk og uden en installeret browser.
 */
export interface AdapterDeps {
  fetchHtml: (url: string) => Promise<string>;
  renderHtml: (url: string) => Promise<string>;
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
  deps: Partial<AdapterDeps> = {},
): ProviderAdapter {
  const fetchHtml = deps.fetchHtml ?? defaultFetchHtml;
  const renderHtml = deps.renderHtml ?? fetchRenderedHtml;

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
        const message = (err as Error).message;
        // En 403 er udbyderens udtrykkelige afvisning af vores identificerede
        // bot. Den forsøges ikke omgået med en browser eller et andet
        // User-Agent — udbyderen markeres i stedet som utilgængelig.
        if (message.includes("HTTP 403")) {
          return {
            offer: null,
            warning: `${label}: udbyderen afviser vores bot (HTTP 403) — ikke tilgængelig`,
          };
        }
        return { offer: null, warning: `${label}: kunne ikke hente siden (${message})` };
      }

      // Alle beløb nær ordet "mindstepris" hentes, ikke bare det første, så
      // en advarsel kan fortælle præcis hvad der stod på siden. Uden det er
      // en fejlende parser umulig at rette uden selv at kunne åbne siden.
      let candidates = findMinPriceCandidates(html);
      let renderedInBrowser = false;

      // Kun når den serverleverede side hverken har prisen eller nævneværdig
      // tekst, er det værd at bruge en browser. Statisk hentning er hurtigere
      // og belaster udbyderen mindre, så den bliver ved med at komme først.
      if (candidates.length === 0 && looksClientRendered(html)) {
        try {
          html = await renderHtml(ref.url);
          candidates = findMinPriceCandidates(html);
          renderedInBrowser = true;
        } catch (err) {
          return {
            offer: null,
            warning: `${label}: siden bygges i browseren, og gengivelsen fejlede (${(err as Error).message})`,
          };
        }
      }

      const chosen = candidates.find((c) => !c.perMonth && isPlausibleMinPrice(c.value));

      if (!chosen) {
        if (looksOutOfStock(html)) {
          return { offer: null, warning: `${label}: udsolgt hos udbyderen` };
        }
        return {
          offer: null,
          warning: `${label}: ${describeFailure(candidates, renderedInBrowser)}`,
        };
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
function describeFailure(candidates: MinPriceCandidate[], renderedInBrowser: boolean): string {
  const how = renderedInBrowser ? " (selv efter gengivelse i browser)" : "";
  if (candidates.length === 0) {
    return `fandt ingen "mindstepris" på siden${how} — ordlyden kan være en anden`;
  }
  const described = candidates
    .slice(0, 5)
    .map((c) => `${c.value} kr.${c.perMonth ? " (pr. md.)" : ""}`)
    .join(", ");
  return `fandt "mindstepris", men intet brugbart beløb${how} — kandidater: ${described}. Kontekst: "${candidates[0].context}"`;
}
