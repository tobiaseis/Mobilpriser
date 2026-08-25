import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractJsonLd, extractStatedMinPrice, findProductLd } from "../src/html.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf-8");
}

describe("extractStatedMinPrice", () => {
  it("finder mindsteprisen i en typisk formulering", () => {
    const html = fixture("sample-product.html");
    expect(extractStatedMinPrice(html)).toBe(2688);
  });

  it("returnerer null når mindstepris ikke findes på siden", () => {
    const html = fixture("no-mindstepris.html");
    expect(extractStatedMinPrice(html)).toBeNull();
  });

  it("håndterer beløb uden tusindtalspunktum", () => {
    expect(extractStatedMinPrice("<p>Mindstepris: 899 kr.</p>")).toBe(899);
  });

  it("håndterer beløb med tusindtalspunktum og øre", () => {
    expect(extractStatedMinPrice("<p>Mindstepris (6 mdr.): 10.499,00 kr.</p>")).toBe(10499);
  });

  it("er ufølsom over for store/små bogstaver", () => {
    expect(extractStatedMinPrice("<p>MINDSTEPRIS: 1.200 kr.</p>")).toBe(1200);
  });
});

describe("extractJsonLd / findProductLd", () => {
  it("finder Product-noden i JSON-LD og læser navnet ud", () => {
    const html = fixture("sample-product.html");
    const nodes = extractJsonLd(html);
    const product = findProductLd(nodes);
    expect(product).toBeDefined();
    expect(product?.name).toBe("Testtelefon 100");
  });

  it("returnerer tom liste, når der ikke er JSON-LD på siden", () => {
    const html = fixture("no-mindstepris.html");
    expect(extractJsonLd(html)).toEqual([]);
    expect(findProductLd(extractJsonLd(html))).toBeUndefined();
  });
});
