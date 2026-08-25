import { describe, expect, it, vi } from "vitest";
import { priceFromProductLd, scrapeRetailers, type Retailer } from "../src/retailers.js";

const retailer: Retailer = {
  id: "pricerunner",
  name: "PriceRunner",
  urls: { "iphone-17-256gb": "https://www.pricerunner.dk/pl/1-343/Foo" },
};

const allow = vi.fn(async () => true);

describe("priceFromProductLd", () => {
  it("læser prisen fra en Product-node", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"iPhone 17","offers":{"@type":"Offer","price":"6666.00"}}
    </script>`;
    expect(priceFromProductLd(html)).toBe(6666);
  });

  it("læser lowPrice, som prissammenligninger bruger til laveste tilbud", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"iPhone 17","offers":{"@type":"AggregateOffer","lowPrice":6499}}
    </script>`;
    expect(priceFromProductLd(html)).toBe(6499);
  });

  it("håndterer offers som liste", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","offers":[{"@type":"Offer","price":"7999"}]}
    </script>`;
    expect(priceFromProductLd(html)).toBe(7999);
  });

  it("afviser priser uden for fornuftsgrænserne", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","offers":{"price":"49.00"}}
    </script>`;
    expect(priceFromProductLd(html)).toBeNull();
  });

  it("returnerer null uden JSON-LD", () => {
    expect(priceFromProductLd("<p>6.666 kr.</p>")).toBeNull();
  });
});

describe("scrapeRetailers", () => {
  it("opsamler prisen, når robots.txt tillader det", async () => {
    const fetchHtml = vi.fn(
      async () =>
        `<script type="application/ld+json">{"@type":"Product","offers":{"price":"6666"}}</script>`,
    );

    const result = await scrapeRetailers([retailer], { fetchHtml, checkRobots: allow });

    expect(result.prices).toEqual([
      {
        retailer: "pricerunner",
        phoneSlug: "iphone-17-256gb",
        price: 6666,
        url: retailer.urls["iphone-17-256gb"],
      },
    ]);
  });

  it("henter ikke siden, når robots.txt forbyder det", async () => {
    // Det er hele pointen: forbuddet respekteres frem for at blive omgået.
    const fetchHtml = vi.fn(async () => "<p>hemmeligt</p>");
    const deny = vi.fn(async () => false);

    const result = await scrapeRetailers([retailer], { fetchHtml, checkRobots: deny });

    expect(fetchHtml).not.toHaveBeenCalled();
    expect(result.prices).toEqual([]);
    expect(result.warnings[0]).toMatch(/robots\.txt/);
  });

  it("markerer en forhandler som utilgængelig ved 403", async () => {
    const fetchHtml = vi.fn(async () => {
      throw new Error("HTTP 403 for x");
    });

    const result = await scrapeRetailers([retailer], { fetchHtml, checkRobots: allow });

    expect(result.warnings[0]).toMatch(/403.*ikke tilgængelig/);
  });

  it("advarer, når siden ikke har en pris i JSON-LD", async () => {
    const fetchHtml = vi.fn(async () => "<p>ingen struktureret pris</p>");

    const result = await scrapeRetailers([retailer], { fetchHtml, checkRobots: allow });

    expect(result.prices).toEqual([]);
    expect(result.warnings[0]).toMatch(/JSON-LD/);
  });

  it("springer en forhandler uden URL'er over med en advarsel", async () => {
    const result = await scrapeRetailers([{ id: "proshop", name: "Proshop", urls: {} }], {
      checkRobots: allow,
    });

    expect(result.warnings[0]).toMatch(/ingen telefoner konfigureret/);
  });
});
