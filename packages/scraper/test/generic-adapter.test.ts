import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGenericAdapter.discover", () => {
  it("finder kun telefoner der har en konfigureret URL", () => {
    const adapter = createGenericAdapter("telmore", {
      "testtelefon-100-256gb": "https://example.dk/testtelefon-100",
    });
    const other: PhoneTarget = { ...phone, slug: "ikke-konfigureret" };

    const refs = adapter.discover([phone, other]);

    expect(refs).toHaveLength(1);
    expect(refs[0].url).toBe("https://example.dk/testtelefon-100");
  });
});

describe("createGenericAdapter.scrape", () => {
  it("bygger et gyldigt tilbud ud fra den oplyste mindstepris", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture("sample-product.html"), { status: 200 })),
    );

    const adapter = createGenericAdapter("telmore", {
      "testtelefon-100-256gb": "https://example.dk/testtelefon-100",
    });
    const result = await adapter.scrape({ target: phone, url: "https://example.dk/testtelefon-100" });

    expect(result.warning).toBeUndefined();
    expect(result.offer).not.toBeNull();
    expect(result.offer?.statedMinPrice).toBe(2688);
    expect(result.offer?.provider).toBe("telmore");
    expect(result.offer?.bindingMonths).toBe(6);
    expect(result.offer?.confidence).toBe("medium"); // JSON-LD Product fundet
  });

  it("returnerer en advarsel, når mindsteprisen ikke kan findes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture("no-mindstepris.html"), { status: 200 })),
    );

    const adapter = createGenericAdapter("telmore", {
      "testtelefon-100-256gb": "https://example.dk/testtelefon-100",
    });
    const result = await adapter.scrape({ target: phone, url: "https://example.dk/testtelefon-100" });

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/mindstepris/i);
  });

  it("returnerer en advarsel ved HTTP-fejl i stedet for at kaste", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ikke fundet", { status: 404 })),
    );

    const adapter = createGenericAdapter("telmore", {
      "testtelefon-100-256gb": "https://example.dk/testtelefon-100",
    });
    const result = await adapter.scrape({ target: phone, url: "https://example.dk/testtelefon-100" });

    expect(result.offer).toBeNull();
    expect(result.warning).toMatch(/404/);
  });
});
