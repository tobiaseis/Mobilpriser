import { describe, expect, it } from "vitest";
import {
  calculateReference,
  computeMinPriceFromComponents,
  crossCheckDeltaKr,
  crossCheckPasses,
  subscriptionCostOverBinding,
  verdictFor,
} from "../src/pricing.js";

describe("subscriptionCostOverBinding", () => {
  it("summerer normalpris over 6 måneder uden kampagne", () => {
    // 149 kr./md. i 6 måneder = 894 kr.
    expect(subscriptionCostOverBinding({ planMonthly: 149 })).toBe(894);
  });

  it("bruger kampagnepris i kampagnemånederne og normalpris resten", () => {
    // CBB-eksempel: 2 mdr. gratis (0 kr.), derefter 149 kr./md. i 4 måneder
    // 0 + 0 + 149 + 149 + 149 + 149 = 596
    expect(
      subscriptionCostOverBinding({
        planMonthly: 149,
        campaignMonthly: 0,
        campaignMonths: 2,
      }),
    ).toBe(596);
  });

  it("Telmore-eksempel: 69 kr. de første 3 mdr., derefter 149 kr.", () => {
    // 69*3 + 149*3 = 207 + 447 = 654
    expect(
      subscriptionCostOverBinding({
        planMonthly: 149,
        campaignMonthly: 69,
        campaignMonths: 3,
      }),
    ).toBe(654);
  });

  it("returnerer null uden kendt normalpris", () => {
    expect(subscriptionCostOverBinding({})).toBeNull();
  });
});

describe("computeMinPriceFromComponents", () => {
  it("regner mindsteprisen ud fra komponenterne", () => {
    // 0 udbetaling + 0 gebyrer + 299 kr./md. afbetaling i 6 mdr. (1.794)
    // + 149 kr./md. abonnement i 6 mdr. (894) = 2.688
    const result = computeMinPriceFromComponents({
      upfront: 0,
      deviceMonthly: 299,
      planMonthly: 149,
    });
    expect(result).toBe(2688);
  });

  it("lægger udbetaling, oprettelse og fragt oveni", () => {
    // 1.199 + 50 + 39 + 249*6 (1.494) + 229*6 (1.374) = 4.156
    const result = computeMinPriceFromComponents({
      upfront: 1199,
      setupFee: 50,
      shippingFee: 39,
      deviceMonthly: 249,
      planMonthly: 229,
    });
    expect(result).toBe(4156);
  });

  it("returnerer null når afbetaling eller abonnement mangler", () => {
    expect(computeMinPriceFromComponents({ planMonthly: 149 })).toBeNull();
    expect(computeMinPriceFromComponents({ deviceMonthly: 299 })).toBeNull();
  });
});

describe("crossCheckDeltaKr / crossCheckPasses", () => {
  it("finder ingen afvigelse, når det beregnede tal matcher det oplyste", () => {
    const delta = crossCheckDeltaKr(2688, {
      upfront: 0,
      deviceMonthly: 299,
      planMonthly: 149,
    });
    expect(delta).toBe(0);
    expect(crossCheckPasses(delta)).toBe(true);
  });

  it("flager en afvigelse større end tolerancen", () => {
    const delta = crossCheckDeltaKr(2000, {
      upfront: 0,
      deviceMonthly: 299,
      planMonthly: 149,
    });
    // beregnet 2.688 mod oplyst 2.000 = afvigelse på 688
    expect(delta).toBe(688);
    expect(crossCheckPasses(delta)).toBe(false);
  });

  it("en afvigelse inden for tolerancen (50 kr.) er en pass", () => {
    const delta = crossCheckDeltaKr(2650, {
      upfront: 0,
      deviceMonthly: 299,
      planMonthly: 149,
    });
    expect(delta).toBe(38);
    expect(crossCheckPasses(delta)).toBe(true);
  });

  it("returnerer null (dermed pass) når der ikke er nok komponenter", () => {
    expect(crossCheckDeltaKr(2688, {})).toBeNull();
    expect(crossCheckPasses(null)).toBe(true);
  });
});

describe("calculateReference", () => {
  it("lægger kontantpris og 6 måneders SIM-only sammen", () => {
    // 8.499 + 89*6 (534) = 9.033
    expect(calculateReference(8499, 89)).toBe(9033);
  });
});

describe("verdictFor", () => {
  const reference = 9033;

  it("er 'good' klart under referencen", () => {
    expect(verdictFor(2688, reference)).toBe("good");
  });

  it("er 'bad' klart over referencen", () => {
    expect(verdictFor(9500, reference)).toBe("bad");
  });

  it("er 'neutral' inden for ±300 kr.", () => {
    expect(verdictFor(reference + 300, reference)).toBe("neutral");
    expect(verdictFor(reference - 300, reference)).toBe("neutral");
  });

  it("vipper til 'bad' lige uden for båndet", () => {
    expect(verdictFor(reference + 301, reference)).toBe("bad");
  });

  it("vipper til 'good' lige uden for båndet", () => {
    expect(verdictFor(reference - 301, reference)).toBe("good");
  });
});
