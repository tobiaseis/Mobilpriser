import { describe, expect, it } from "vitest";
import { BINDING_MONTHS, OfferSchema } from "../src/types.js";

function validOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: "telmore:iphone-17-256gb",
    provider: "telmore",
    phone: {
      brand: "Apple",
      model: "iPhone 17",
      storage: 256,
      slug: "iphone-17-256gb",
    },
    url: "https://www.telmore.dk/shop/mobiltelefoner/apple/iphone-17",
    minPrice: 2688,
    bindingMonths: BINDING_MONTHS,
    scrapedAt: new Date().toISOString(),
    source: "text-pattern",
    confidence: "high",
    ...overrides,
  };
}

describe("OfferSchema", () => {
  it("accepterer et gyldigt tilbud", () => {
    expect(OfferSchema.safeParse(validOffer()).success).toBe(true);
  });

  it("afviser enhver anden bindingsperiode end 6 måneder", () => {
    const result = OfferSchema.safeParse(validOffer({ bindingMonths: 12 }));
    expect(result.success).toBe(false);
  });

  it("afviser en mindstepris under fornuftsgrænsen", () => {
    const result = OfferSchema.safeParse(validOffer({ minPrice: 10 }));
    expect(result.success).toBe(false);
  });

  it("afviser en mindstepris over fornuftsgrænsen", () => {
    const result = OfferSchema.safeParse(validOffer({ minPrice: 100000 }));
    expect(result.success).toBe(false);
  });

  it("afviser en ukendt udbyder", () => {
    const result = OfferSchema.safeParse(validOffer({ provider: "3" }));
    expect(result.success).toBe(false);
  });

  it("tillader manglende komponenter (defaulter til tomt objekt)", () => {
    const result = OfferSchema.safeParse(validOffer());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.components).toEqual({});
      expect(result.data.computedMinPrice).toBeNull();
    }
  });
});
