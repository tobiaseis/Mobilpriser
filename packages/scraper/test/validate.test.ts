import { describe, expect, it } from "vitest";
import { BINDING_MONTHS, type Offer, type ProviderId } from "@mobilpriser/core";
import { dropCrossModelDuplicates } from "../src/validate.js";

function offer(provider: ProviderId, slug: string, statedMinPrice: number): Offer {
  return {
    id: `${provider}:${slug}`,
    provider,
    phone: { brand: "Samsung", model: slug, storage: 256, slug },
    url: `https://example.dk/${slug}`,
    statedMinPrice,
    components: {},
    computedMinPrice: null,
    bindingMonths: BINDING_MONTHS,
    scrapedAt: new Date().toISOString(),
    source: "text-pattern",
    confidence: "medium",
  };
}

describe("dropCrossModelDuplicates", () => {
  it("kasserer et beløb, der er ens for to forskellige telefoner hos samme udbyder", () => {
    // Præcis det, YouSee gav: 1.813 kr. for både S26 og S26 Ultra.
    const result = dropCrossModelDuplicates([
      offer("yousee", "samsung-galaxy-s26-256gb", 1813),
      offer("yousee", "samsung-galaxy-s26-ultra-256gb", 1813),
    ]);

    expect(result.kept).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("1813");
    expect(result.warnings[0]).toContain("yousee");
  });

  it("beholder resten af udbyderens tilbud", () => {
    const good = offer("yousee", "iphone-17-256gb", 8499);
    const result = dropCrossModelDuplicates([
      offer("yousee", "samsung-galaxy-s26-256gb", 1813),
      offer("yousee", "samsung-galaxy-s26-ultra-256gb", 1813),
      good,
    ]);

    expect(result.kept).toEqual([good]);
  });

  it("rører ikke ens priser hos forskellige udbydere", () => {
    // To udbydere kan udmærket lande på samme mindstepris for samme telefon.
    const offers = [
      offer("telenor", "iphone-17-256gb", 7733),
      offer("telmore", "iphone-17-256gb", 7733),
    ];

    const result = dropCrossModelDuplicates(offers);

    expect(result.kept).toEqual(offers);
    expect(result.warnings).toEqual([]);
  });

  it("rører ikke forskellige priser for forskellige telefoner", () => {
    const offers = [
      offer("telmore", "samsung-galaxy-s26-256gb", 9293),
      offer("telmore", "samsung-galaxy-s26-ultra-256gb", 12293),
    ];

    const result = dropCrossModelDuplicates(offers);

    expect(result.kept).toEqual(offers);
    expect(result.warnings).toEqual([]);
  });

  it("håndterer en tom liste", () => {
    expect(dropCrossModelDuplicates([])).toEqual({ kept: [], warnings: [] });
  });
});
