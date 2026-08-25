import { describe, expect, it } from "vitest";
import { BINDING_MONTHS, type Offer, type ProviderId } from "@mobilpriser/core";
import { buildReference } from "../src/reference.js";

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

describe("buildReference", () => {
  it("vælger den laveste forhandlerpris pr. telefon", () => {
    // Referencen svarer på "kunne jeg gøre det billigere selv", så det er
    // den bedste pris, man realistisk kan finde, der er målestokken.
    const result = buildReference(
      [
        { retailer: "elgiganten", phoneSlug: "s26", price: 8999, url: "https://e/x" },
        { retailer: "pricerunner", phoneSlug: "s26", price: 7999, url: "https://p/x" },
        { retailer: "power", phoneSlug: "i17", price: 7499, url: "https://po/x" },
      ],
      [],
    );

    expect(result.cashPrices).toEqual({ s26: 7999, i17: 7499 });
    expect(result.cashPriceCount).toEqual({ s26: 2, i17: 1 });
    // Kilden gemmes, så en mistænkelig reference kan spores tilbage.
    expect(result.cashPriceSource.s26).toBe("pricerunner");
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
