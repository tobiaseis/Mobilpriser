import { describe, expect, it } from "vitest";
import { BINDING_MONTHS, type Offer, type ProviderId } from "@mobilpriser/core";
import { buildReference, extractCashPrice } from "../src/reference.js";

function offer(provider: ProviderId, planMonthly?: number): Offer {
  return {
    id: `${provider}:x`,
    provider,
    phone: { brand: "Samsung", model: "Galaxy S26", storage: 256, slug: "s26" },
    url: "https://example.dk/s26",
    minPrice: 7000,
    components: planMonthly != null ? { planMonthly } : {},
    computedMinPrice: null,
    bindingMonths: BINDING_MONTHS,
    scrapedAt: new Date().toISOString(),
    source: "text-pattern",
    confidence: "medium",
  };
}

describe("extractCashPrice", () => {
  it("læser en pris, der udtrykkeligt er mærket kontantpris", () => {
    // OiSTER skriver det ligefrem sådan.
    expect(extractCashPrice("<p>Kontantpris 10.800 kr.</p>")).toBe(10800);
  });

  it("læser en pris mærket 'uden abonnement'", () => {
    expect(extractCashPrice("<p>Pris uden abonnement 7.999 kr.</p>")).toBe(7999);
  });

  it("tager ikke et umærket beløb for en kontantpris", () => {
    // Uden etiket kan 7.999 lige så godt være en førpris i en kampagne.
    expect(extractCashPrice("<p>Tilbud 7.999 kr. 2.999 kr.</p>")).toBeNull();
  });

  it("afviser beløb uden for fornuftsgrænserne", () => {
    expect(extractCashPrice("<p>Kontantpris 199 kr.</p>")).toBeNull();
    expect(extractCashPrice("<p>Kontantpris 99.999 kr.</p>")).toBeNull();
  });
});

describe("buildReference", () => {
  it("vælger den laveste oplyste kontantpris pr. telefon", () => {
    // Referencen svarer på "kunne jeg gøre det billigere selv", så det er
    // den bedste pris, man realistisk kan finde, der er målestokken.
    const result = buildReference(
      [
        { phoneSlug: "s26", cashPrice: 8999 },
        { phoneSlug: "s26", cashPrice: 7999 },
        { phoneSlug: "i17", cashPrice: 7499 },
      ],
      [],
    );

    expect(result.cashPrices).toEqual({ s26: 7999, i17: 7499 });
    expect(result.cashPriceSources).toEqual({ s26: 2, i17: 1 });
  });

  it("finder den laveste månedspris på tværs af tilbud", () => {
    const result = buildReference([], [offer("callme", 99), offer("telenor", 289)]);
    expect(result.cheapestMonthly).toBe(99);
  });

  it("giver null for månedsprisen, når ingen tilbud har en", () => {
    expect(buildReference([], [offer("telmore")]).cheapestMonthly).toBeNull();
  });

  it("håndterer en kørsel helt uden observationer", () => {
    const result = buildReference([], []);
    expect(result.cashPrices).toEqual({});
    expect(result.cheapestMonthly).toBeNull();
  });
});
