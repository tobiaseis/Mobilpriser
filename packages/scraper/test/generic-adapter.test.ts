import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createGenericAdapter } from "../src/providers/generic.js";
import type { PhoneTarget } from "@mobilpriser/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf-8");
}

const phone: PhoneTarget = {
  brand: "Testmærke",
  model: "Testtelefon 100",
  storage: 256,
  slug: "testtelefon-100-256gb",
};

const URL = "https://example.dk/testtelefon-100";
const urls = { "testtelefon-100-256gb": URL };
const ref = { target: phone, url: URL };

/** Kaster, hvis den bliver kaldt — bruges når browseren ikke må røres. */
const renderMustNotRun = vi.fn(async () => {
  throw new Error("browser-gengivelse skulle ikke have været brugt");
});

describe("createGenericAdapter.discover", () => {
  it("finder kun telefoner der har en konfigureret URL", () => {
    const adapter = createGenericAdapter("telmore", urls);
    const other: PhoneTarget = { ...phone, slug: "ikke-konfigureret" };

    const refs = adapter.discover([phone, other]);

    expect(refs).toHaveLength(1);
    expect(refs[0].url).toBe(URL);
  });
});

describe("createGenericAdapter.scrape", () => {
  it("bygger et gyldigt tilbud ud fra den oplyste mindstepris", async () => {
    const adapter = createGenericAdapter("telmore", urls, {
      fetchHtml: async () => fixture("sample-product.html"),
      renderHtml: renderMustNotRun,
    });

    const result = await adapter.scrape(ref);

    expect(result.warning).toBeUndefined();
    expect(result.offer?.minPrice).toBe(2688);
    expect(result.offer?.provider).toBe("telmore");
    expect(result.offer?.bindingMonths).toBe(6);
    expect(result.offer?.confidence).toBe("medium"); // JSON-LD Product fundet
  });

  it("rapporterer udsolgt som lagerstatus på en færdig side", async () => {
    const adapter = createGenericAdapter("telmore", urls, {
      // Tekstrig side, så lagerstatus kan tros — den er ikke et skelet.
      fetchHtml: async () => fixture("sold-out.html") + `<p>${"tekst ".repeat(1200)}</p>`,
      renderHtml: renderMustNotRun,
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/udsolgt/i);
  });

  it("tror ikke på 'Udsolgt' i et klient-tegnet skelet, men gengiver siden", async () => {
    // Telmores skelet indeholder både "0 kr." og "Udsolgt" som pladsholdere.
    // Tages de for pålydende, rapporteres en udsolgt telefon, der er på lager.
    const renderHtml = vi.fn(async () => fixture("rendered-product.html"));
    const adapter = createGenericAdapter("telmore", urls, {
      fetchHtml: async () => fixture("client-skeleton.html"),
      renderHtml,
    });

    const result = await adapter.scrape(ref);

    expect(renderHtml).toHaveBeenCalledOnce();
    expect(result.warning).toBeUndefined();
    expect(result.offer?.minPrice).toBe(7543);
  });

  it("gengiver siden, selv når skelettet indeholder et ubrugeligt beløb", async () => {
    // Regressionstest: betingelsen for gengivelse må ikke være "ingen tal
    // fundet", for skelettet indeholder pladsholderen "0 kr.".
    const renderHtml = vi.fn(async () => fixture("rendered-product.html"));
    const adapter = createGenericAdapter("telmore", urls, {
      fetchHtml: async () => "<div id='app'><p>Mindstepris i 6 måneder 0 kr.</p></div>",
      renderHtml,
    });

    await adapter.scrape(ref);

    expect(renderHtml).toHaveBeenCalledOnce();
  });

  it("henter siden igen med browser, når den bygges i browseren", async () => {
    const renderHtml = vi.fn(async () => fixture("sample-product.html"));
    const adapter = createGenericAdapter("callme", urls, {
      // Serverleveret side uden pris og næsten uden tekst — som Call me's.
      fetchHtml: async () => "<html><body><div id='app'></div></body></html>",
      renderHtml,
    });

    const result = await adapter.scrape(ref);

    expect(renderHtml).toHaveBeenCalledOnce();
    expect(result.offer?.minPrice).toBe(2688);
  });

  it("bruger ikke browseren, når den statiske side allerede har prisen", async () => {
    const adapter = createGenericAdapter("telenor", urls, {
      fetchHtml: async () => fixture("sample-product.html"),
      renderHtml: renderMustNotRun,
    });

    await adapter.scrape(ref);

    expect(renderMustNotRun).not.toHaveBeenCalled();
  });

  it("markerer udbyderen som utilgængelig ved 403 uden at prøve browseren", async () => {
    // En 403 er en udtrykkelig afvisning af vores bot. Den omgås ikke.
    const adapter = createGenericAdapter("cbb", urls, {
      fetchHtml: async () => {
        throw new Error(`HTTP 403 for ${URL}`);
      },
      renderHtml: renderMustNotRun,
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/403.*ikke tilgængelig/i);
    expect(renderMustNotRun).not.toHaveBeenCalled();
  });

  it("returnerer en advarsel med de beløb, der faktisk stod på siden", async () => {
    const page = `<p>${"fyld ".repeat(1200)}Mindstepris: 12 kr.</p>`;
    const adapter = createGenericAdapter("telmore", urls, {
      fetchHtml: async () => page,
      // Gengivelse hjælper ikke her; siden ser ens ud.
      renderHtml: async () => page,
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toContain("12 kr.");
    expect(result.warning).toContain("browser");
  });

  it("gengiver også en tekstrig side, når prisen ikke kunne findes statisk", async () => {
    // Norlys-tilfældet: skelettet har rigelig navigationstekst, så en
    // tærskel for "ser klient-tegnet ud" ville aldrig udløse gengivelsen —
    // men prisen findes først bagefter.
    const renderHtml = vi.fn(async () => fixture("rendered-product.html"));
    const adapter = createGenericAdapter("norlys", urls, {
      fetchHtml: async () => `<p>${"Menu Mobil Internet Kundeservice ".repeat(300)}</p>`,
      renderHtml,
    });

    const result = await adapter.scrape(ref);

    expect(renderHtml).toHaveBeenCalledOnce();
    expect(result.offer?.minPrice).toBe(7543);
  });

  it("gengiver ikke en tekstrig side, der udtrykkeligt er udsolgt", async () => {
    const adapter = createGenericAdapter("telmore", urls, {
      fetchHtml: async () => fixture("sold-out.html") + `<p>${"tekst ".repeat(1200)}</p>`,
      renderHtml: renderMustNotRun,
    });

    await adapter.scrape(ref);

    expect(renderMustNotRun).not.toHaveBeenCalled();
  });

  it("returnerer en advarsel ved andre HTTP-fejl i stedet for at kaste", async () => {
    const adapter = createGenericAdapter("telmore", urls, {
      fetchHtml: async () => {
        throw new Error(`HTTP 500 for ${URL}`);
      },
      renderHtml: renderMustNotRun,
    });

    const result = await adapter.scrape(ref);

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/500/);
  });
});
