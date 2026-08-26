import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PhoneTarget } from "@mobilpriser/core";
import { youseeAdapter } from "../src/providers/yousee.js";
import { findPlanInText, loadPlans } from "../src/plans.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf-8");
}

const phone: PhoneTarget = {
  brand: "Samsung",
  model: "Galaxy S26",
  storage: 256,
  slug: "samsung-galaxy-s26-256gb",
};
const ref = {
  target: phone,
  url: "https://yousee.dk/shop/mobiltelefoner/samsung/galaxy-s26",
};

describe("loadPlans / findPlanInText", () => {
  it("læser YouSees abonnementer fra config", () => {
    const plans = loadPlans("yousee");
    expect(plans.map((p) => p.name)).toContain("50 GB Mobil");
    expect(plans.find((p) => p.name === "Fri Data Mobil")?.monthly).toBe(299);
  });

  it("finder abonnementet, siden binder tilbuddet til", () => {
    const plans = [
      { name: "50 GB Mobil", monthly: 219 },
      { name: "Fri Data Mobil", monthly: 299 },
    ];
    const plan = findPlanInText("Rabat 5.000 kr. Med 50 GB Mobil 10-25 W", plans);
    expect(plan?.monthly).toBe(219);
  });

  it("vælger det abonnement, tilbuddet er bundet til med ordet 'Med'", () => {
    // YouSees side nævner begge abonnementer i en vælger, men binder
    // prisen til ét af dem. Uden dette faldt hele tilbuddet ud.
    const plans = [
      { name: "50 GB Mobil", monthly: 219 },
      { name: "Fri Data Mobil", monthly: 299 },
    ];
    const text =
      "Tilbud 7.499 kr. 5.899 kr. Rabat 1.600 kr. Med Fri Data Mobil " +
      "Vælg abonnement 50 GB Mobil Fri Data Mobil";

    expect(findPlanInText(text, plans)?.monthly).toBe(299);
  });

  it("vælger ikke, når flere abonnementer er bundet til tilbuddet", () => {
    // At gætte ville lægge 6 x forskellen i månedspris ind i mindsteprisen.
    const plans = [
      { name: "50 GB Mobil", monthly: 219 },
      { name: "Fri Data Mobil", monthly: 299 },
    ];
    expect(findPlanInText("Med 50 GB Mobil eller Med Fri Data Mobil", plans)).toBeNull();
  });

  it("vælger ikke, når flere nævnes uden at nogen er bundet", () => {
    const plans = [
      { name: "50 GB Mobil", monthly: 219 },
      { name: "Fri Data Mobil", monthly: 299 },
    ];
    expect(findPlanInText("Vælg mellem 50 GB Mobil og Fri Data Mobil", plans)).toBeNull();
  });

  it("returnerer null, når intet kendt abonnement nævnes", () => {
    expect(findPlanInText("Ingen abonnementer her", [{ name: "50 GB Mobil", monthly: 219 }])).toBeNull();
  });
});

describe("youseeAdapter.scrape", () => {
  it("regner mindsteprisen ud af telefonpris og abonnement", async () => {
    const adapter = youseeAdapter({ fetchHtml: async () => fixture("yousee-product.html") });

    const result = await adapter.scrape(ref);

    // 2.999 kr. for telefonen + 6 x 219 kr. abonnement = 4.313 kr.
    expect(result.warning).toBeUndefined();
    expect(result.offer?.minPrice).toBe(4313);
    expect(result.offer?.source).toBe("computed");
    expect(result.offer?.confidence).toBe("low");
  });

  it("gemmer komponenterne, så tallet kan efterprøves", async () => {
    const adapter = youseeAdapter({ fetchHtml: async () => fixture("yousee-product.html") });

    const result = await adapter.scrape(ref);

    expect(result.offer?.components).toMatchObject({
      upfront: 2999,
      deviceMonthly: 0,
      planName: "50 GB Mobil",
      planMonthly: 219,
      dataGb: 50,
    });
  });

  it("tager ikke tilbehørets mindstepris for telefonens", async () => {
    // Siden indeholder "Mindstepris 6 mdr. 1.813 kr." for et par høretelefoner.
    // Det tal må aldrig ende som telefonens pris — det var netop den fejl,
    // der gav samme beløb for Galaxy S26 og S26 Ultra.
    const adapter = youseeAdapter({ fetchHtml: async () => fixture("yousee-product.html") });

    const result = await adapter.scrape(ref);

    expect(result.offer?.minPrice).not.toBe(1813);
  });

  it("advarer i stedet for at gætte, når telefonprisen mangler", async () => {
    const adapter = youseeAdapter({
      fetchHtml: async () => "<html><body><p>Med 50 GB Mobil</p></body></html>",
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/telefonpris/i);
  });

  it("advarer, når abonnementet ikke kan afgøres", async () => {
    const adapter = youseeAdapter({
      fetchHtml: async () =>
        `<html><head><script type="application/ld+json">
          {"@type":"Product","name":"X","offers":{"price":"2999.00","@type":"Offer"}}
        </script></head><body><p>Ingen kendt abonnementstekst</p></body></html>`,
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/abonnement/i);
  });

  it("returnerer en advarsel ved HTTP-fejl i stedet for at kaste", async () => {
    const adapter = youseeAdapter({
      fetchHtml: async () => {
        throw new Error("HTTP 500 for " + ref.url);
      },
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/500/);
  });
});
