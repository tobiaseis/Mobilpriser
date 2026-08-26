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

describe("buildReference — udslag i forhandlerpriser", () => {
  it("bruger en markant lavere pris, men noterer den", () => {
    // PriceRunner gav S26 Ultra til 7.198 kr. mod Elgigantens 11.499.
    // Forskellen er parallelimport, ikke brugte telefoner — telefonen er
    // ny og fungerer, så prisen er en ærlig målestok for hvad det koster
    // at skaffe den selv. Springet noteres, så tallet kan efterprøves.
    const result = buildReference(
      [
        { retailer: "pricerunner", phoneSlug: "ultra", price: 7198, url: "https://p/x" },
        { retailer: "elgiganten", phoneSlug: "ultra", price: 11499, url: "https://e/x" },
      ],
      [],
    );

    expect(result.cashPrices.ultra).toBe(7198);
    expect(result.cashPriceSource.ultra).toBe("pricerunner");
    expect(result.warnings[0]).toContain("parallelimport");
  });

  it("beholder en pris, der blot er lidt lavere", () => {
    // 6.890 mod 6.999 er et almindeligt udsalg, ikke en anden vare.
    const result = buildReference(
      [
        { retailer: "pricerunner", phoneSlug: "i17", price: 6890, url: "https://p/x" },
        { retailer: "power", phoneSlug: "i17", price: 6999, url: "https://po/x" },
      ],
      [],
    );

    expect(result.cashPrices.i17).toBe(6890);
    expect(result.warnings).toEqual([]);
  });

  it("accepterer en enlig pris, da der intet er at sammenligne med", () => {
    const result = buildReference(
      [{ retailer: "elgiganten", phoneSlug: "pro", price: 9399, url: "https://e/x" }],
      [],
    );

    expect(result.cashPrices.pro).toBe(9399);
    expect(result.warnings).toEqual([]);
  });
});
