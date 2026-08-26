import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { extractJsonLd, fetchHtml as defaultFetchHtml, findProductLd } from "./html.js";
import { fetchRenderedHtml } from "./browser.js";
import { isUrlAllowed } from "./robots.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RETAILERS_PATH = path.resolve(__dirname, "../../../config/retailers.yaml");

interface RawRetailers {
  retailers: Record<string, { name?: string; urls?: Record<string, string> }>;
}

export interface Retailer {
  id: string;
  name: string;
  urls: Record<string, string>;
}

export function loadRetailers(retailersPath: string = DEFAULT_RETAILERS_PATH): Retailer[] {
  const raw = parseYaml(readFileSync(retailersPath, "utf-8")) as RawRetailers;
  return Object.entries(raw.retailers ?? {}).map(([id, cfg]) => ({
    id,
    name: cfg.name ?? id,
    urls: cfg.urls ?? {},
  }));
}

const MIN_PRICE = 1000;
const MAX_PRICE = 30000;

/**
 * Prisen fra JSON-LD'ens Product.
 *
 * Webshops udgiver den til Google Shopping og har en direkte interesse i,
 * at den er korrekt — langt mere pålideligt end at læse et tal ud af
 * markup, der kan indeholde både førpris, medlemspris og afbetaling.
 * Feltet optræder som `price` eller `lowPrice`, og `offers` kan være en
 * liste, når varen sælges i flere tilstande.
 */
export function priceFromProductLd(html: string): number | null {
  const product = findProductLd(extractJsonLd(html));
  if (!product) return null;

  const offers = product.offers;
  const candidates = Array.isArray(offers) ? offers : [offers];

  for (const offer of candidates) {
    if (!offer || typeof offer !== "object") continue;
    const record = offer as { price?: unknown; lowPrice?: unknown };
    for (const raw of [record.price, record.lowPrice]) {
      if (raw == null) continue;
      const value = typeof raw === "number" ? raw : Number(String(raw));
      if (Number.isFinite(value) && value >= MIN_PRICE && value <= MAX_PRICE) {
        return Math.round(value);
      }
    }
  }
  return null;
}

export interface RetailerPrice {
  retailer: string;
  phoneSlug: string;
  price: number;
  url: string;
}

export interface RetailerScrapeResult {
  prices: RetailerPrice[];
  warnings: string[];
}

export interface RetailerDeps {
  fetchHtml: (url: string) => Promise<string>;
  /** Høflighedspause mellem hvert hent. */
  delay: () => Promise<void>;
  /** Kan slås fra i tests; i produktion spørges robots.txt altid. */
  checkRobots: (url: string, fetchText: (url: string) => Promise<string>) => Promise<boolean>;
  renderHtml: (url: string) => Promise<string>;
}

export async function scrapeRetailers(
  retailers: Retailer[],
  deps: Partial<RetailerDeps> = {},
): Promise<RetailerScrapeResult> {
  const fetchHtml = deps.fetchHtml ?? defaultFetchHtml;
  const delay = deps.delay ?? (() => Promise.resolve());
  const checkRobots = deps.checkRobots ?? isUrlAllowed;
  const renderHtml = deps.renderHtml ?? fetchRenderedHtml;

  const prices: RetailerPrice[] = [];
  const warnings: string[] = [];

  for (const retailer of retailers) {
    const entries = Object.entries(retailer.urls);
    if (entries.length === 0) {
      warnings.push(`${retailer.id}: ingen telefoner konfigureret med URL endnu`);
      continue;
    }

    for (const [phoneSlug, url] of entries) {
      const label = `${retailer.id}/${phoneSlug}`;
      try {
        // Forhandlernes prisdata er deres produkt, så spørgsmålet om vi må
        // hente dem, stilles til deres robots.txt frem for at blive antaget.
        if (!(await checkRobots(url, fetchHtml))) {
          warnings.push(`${label}: robots.txt tillader os ikke at hente siden — sprunget over`);
          await delay();
          continue;
        }

        let price = priceFromProductLd(await fetchHtml(url));

        // Prissammenligninger og større webshops bygger ofte siden i
        // browseren, og så er der ingen JSON-LD i det, serveren udleverer.
        // Gengivelse er den eneste mulighed tilbage, når den statiske side
        // ikke havde prisen.
        if (price == null) {
          price = priceFromProductLd(await renderHtml(url));
        }

        if (price == null) {
          warnings.push(`${label}: fandt ingen pris i JSON-LD, heller ikke efter gengivelse`);
        } else {
          prices.push({ retailer: retailer.id, phoneSlug, price, url });
        }
      } catch (err) {
        const message = (err as Error).message;
        // Samme regel som for udbyderne: en 403 er en udtrykkelig
        // afvisning af vores bot, og den omgås ikke.
        warnings.push(
          message.includes("HTTP 403")
            ? `${label}: forhandleren afviser vores bot (HTTP 403) — ikke tilgængelig`
            : `${label}: kunne ikke hente siden (${message})`,
        );
      }
      await delay();
    }
  }

  return { prices, warnings };
}
