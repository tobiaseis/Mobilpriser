import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractJsonLd,
  extractStatedMinPrice,
  findMinPriceCandidates,
  findProductLd,
  looksClientRendered,
  looksOutOfStock,
  pageText,
  parseDanishAmount,
} from "../src/html.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf-8");
}

describe("pageText", () => {
  it("afkoder HTML-entiteter, så &nbsp; ikke deler et beløb", () => {
    expect(pageText("<p>4.499&nbsp;kr.</p>")).toBe("4.499 kr.");
  });

  it("udelader indholdet af script- og style-tags", () => {
    const text = pageText("<script>var a = 1;</script><style>p{}</style><p>Synligt</p>");
    expect(text).toBe("Synligt");
  });
});

describe("parseDanishAmount", () => {
  it("håndterer tusindtalspunktum", () => {
    expect(parseDanishAmount("4.499")).toBe(4499);
  });

  it("kasserer ører", () => {
    expect(parseDanishAmount("10.499,00")).toBe(10499);
    expect(parseDanishAmount("99,50")).toBe(99);
  });

  it("håndterer tal uden separator", () => {
    expect(parseDanishAmount("899")).toBe(899);
  });
});

describe("extractStatedMinPrice", () => {
  it("finder mindsteprisen i en typisk formulering", () => {
    expect(extractStatedMinPrice(fixture("sample-product.html"))).toBe(2688);
  });

  it("springer månedsydelsen over og tager totalen, selv med &nbsp;", () => {
    // Denne kombination fik parseren til at fejle i produktion.
    expect(extractStatedMinPrice(fixture("nbsp-mindstepris.html"))).toBe(4499);
  });

  it("håndterer beløb skrevet som 'kr. 5.299'", () => {
    expect(extractStatedMinPrice(fixture("kr-first-mindstepris.html"))).toBe(5299);
  });

  it("ignorerer ordet når det kun står i et script-tag", () => {
    expect(extractStatedMinPrice(fixture("script-noise-mindstepris.html"))).toBe(3799);
  });

  it("returnerer null når mindstepris ikke findes på siden", () => {
    expect(extractStatedMinPrice(fixture("no-mindstepris.html"))).toBeNull();
  });

  it("afviser et beløb under fornuftsgrænsen", () => {
    expect(extractStatedMinPrice("<p>Mindstepris: 0 kr.</p>")).toBeNull();
  });

  it("afviser et beløb over fornuftsgrænsen", () => {
    expect(extractStatedMinPrice("<p>Mindstepris: 99.999 kr.</p>")).toBeNull();
  });

  it("er ufølsom over for store/små bogstaver", () => {
    expect(extractStatedMinPrice("<p>MINDSTEPRIS: 1.200 kr.</p>")).toBe(1200);
  });
});

describe("findMinPriceCandidates", () => {
  it("returnerer alle beløb nær ordet, med markering af månedsydelser", () => {
    const candidates = findMinPriceCandidates(fixture("nbsp-mindstepris.html"));
    expect(candidates.map((c) => c.value)).toEqual([299, 4499]);
    expect(candidates[0].perMonth).toBe(true);
    expect(candidates[1].perMonth).toBe(false);
  });

  it("giver kontekst med, så en fejlende parser kan rettes", () => {
    const candidates = findMinPriceCandidates(fixture("kr-first-mindstepris.html"));
    expect(candidates[0].context).toContain("Mindstepris for 6 mdr.");
  });

  it("returnerer tom liste når ordet ikke findes", () => {
    expect(findMinPriceCandidates(fixture("no-mindstepris.html"))).toEqual([]);
  });
});

describe("extractJsonLd / findProductLd", () => {
  it("finder Product-noden i JSON-LD og læser navnet ud", () => {
    const product = findProductLd(extractJsonLd(fixture("sample-product.html")));
    expect(product?.name).toBe("Testtelefon 100");
  });

  it("returnerer tom liste, når der ikke er JSON-LD på siden", () => {
    expect(extractJsonLd(fixture("no-mindstepris.html"))).toEqual([]);
  });
});

describe("looksOutOfStock", () => {
  it("genkender en udsolgt side", () => {
    // Telmore viser "Mindstepris i 6 måneder 0 kr. Udsolgt" — nul kroner er
    // her en lagerstatus, ikke et parserproblem.
    const html = fixture("sold-out.html");
    expect(looksOutOfStock(html)).toBe(true);
    expect(extractStatedMinPrice(html)).toBeNull();
  });

  it("markerer ikke en normal side som udsolgt", () => {
    expect(looksOutOfStock(fixture("sample-product.html"))).toBe(false);
  });
});

describe("looksClientRendered", () => {
  it("genkender en side, der næsten ingen synlig tekst har", () => {
    expect(looksClientRendered("<html><body><div id='app'></div></body></html>")).toBe(true);
  });

  it("markerer ikke en tekstrig side som klient-tegnet", () => {
    expect(looksClientRendered(`<p>${"tekst ".repeat(1200)}</p>`)).toBe(false);
  });
});

describe("pageText", () => {
  it("lader ikke doctype-erklæringen sive ind i teksten", () => {
    expect(pageText("<!DOCTYPE html><html><body><p>Hej</p></body></html>")).toBe("Hej");
  });
});
