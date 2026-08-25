import { describe, expect, it } from "vitest";
import { deriveComponents } from "../src/components.js";

describe("deriveComponents", () => {
  it("udleder Call mes struktur: telefonen betales ved køb", () => {
    // Ordret fra Call mes gengivne side.
    const html = `<p>Mindstepris i bindingsperioden 7.142 kr.
      Samsung Galaxy S26 256GB Cobalt violet betal her og nu 6.499 kr.
      Abonnement (6 mdr.) 99 kr. pr. md. i alt 594 kr. Oprettelse 49 kr.</p>`;

    const result = deriveComponents(html, 7142);

    // 6.499 + 6 x 99 = 7.093, og de sidste 49 kr. er oprettelsen.
    expect(result).toEqual({ upfront: 6499, planMonthly: 99, fees: 49 });
  });

  it("udleder Telenors struktur uden gebyr", () => {
    const html = `<p>Mindstepris (6 mdr.) 7.733 kr. Prisen dækker telefonen til
      5.999 kr. og Fri Data + Fri tale 289 kr./md.</p>`;

    const result = deriveComponents(html, 7733);

    // 5.999 + 6 x 289 = 7.733 præcis.
    expect(result).toEqual({ upfront: 5999, planMonthly: 289, fees: 0 });
  });

  it("returnerer null, når intet par går op", () => {
    // Beløbene på siden kan ikke sammensættes til mindsteprisen, så der
    // er intet at vise — og så vises der ingenting frem for et gæt.
    const html = "<p>Mindstepris 9.999 kr. Tilbehør 229 kr. Cover 199 kr.</p>";

    expect(deriveComponents(html, 9999)).toBeNull();
  });

  it("vælger telefonprisen frem for et lille beløb ganget op", () => {
    // 1.000 x 6 = 6.000 ville også ramme, men 6.000 er ikke en månedspris.
    // Det største telefonbeløb, der går op, skal vinde.
    const html = "<p>Mindstepris 7.000 kr. Telefon 5.800 kr. Abonnement 200 kr. Rabat 1.000 kr.</p>";

    const result = deriveComponents(html, 7000);

    expect(result?.upfront).toBe(5800);
    expect(result?.planMonthly).toBe(200);
  });

  it("accepterer ikke et gebyr, der er for stort til at være oprettelse", () => {
    // 5.000 + 6 x 100 = 5.600 lader 900 kr. uforklaret. Så er strukturen
    // ikke forstået, og komponenterne må ikke vises.
    const html = "<p>Mindstepris 6.500 kr. Telefon 5.000 kr. Abonnement 100 kr.</p>";

    expect(deriveComponents(html, 6500)).toBeNull();
  });

  it("håndterer beløb med &nbsp; og tusindtalspunktum", () => {
    const html = "<p>Mindstepris 7.142&nbsp;kr. Telefon 6.499&nbsp;kr. Abonnement 99&nbsp;kr.</p>";

    const result = deriveComponents(html, 7142);

    expect(result?.upfront).toBe(6499);
    expect(result?.planMonthly).toBe(99);
  });
});
