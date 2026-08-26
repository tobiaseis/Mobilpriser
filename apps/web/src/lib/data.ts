import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { LatestFile, PhoneTarget, ReferenceFile } from "./model";

/**
 * Data læses fra repo-rodens data/ og config/ mapper — websitet er
 * udelukkende en visning af, hvad den daglige scraper allerede har skrevet
 * og committet. Der sker aldrig kald til udbydernes sider herfra.
 */
const REPO_ROOT = path.join(process.cwd(), "..", "..");

export * from "./model";

/**
 * Filerne er bygget ind i sitet: de ændrer sig, når scraperen har committet
 * og Vercel har bygget om — aldrig mens processen kører. Derfor læses hver
 * fil én gang pr. proces frem for én gang pr. side.
 *
 * Uden det læste bygningen de samme fire filer forfra for hver side:
 * layoutet henter latest.json, forsiden henter alle tre, og hver
 * telefonside henter phones.yaml tre gange — én gang til ruterne, én til
 * titlen og én til siden selv.
 *
 * Det er stadig kun statiske data i modulomfang, aldrig noget der hører
 * til en enkelt besøgende. To sideopbygninger, der kører samtidig, kan
 * derfor ikke komme til at læse hinandens tal.
 *
 * I udvikling springes cachen over, så en rettelse i data/ slår igennem
 * ved næste genindlæsning frem for ved næste genstart af serveren.
 */
const CACHE_STATIC_FILES = process.env.NODE_ENV === "production";

function readOnce<T>(read: () => T): () => T {
  let cached: T;
  let loaded = false;

  return () => {
    if (!CACHE_STATIC_FILES) return read();
    if (!loaded) {
      cached = read();
      loaded = true;
    }
    return cached;
  };
}

export const loadPhones = readOnce((): PhoneTarget[] => {
  const raw = readFileSync(path.join(REPO_ROOT, "config", "phones.yaml"), "utf-8");
  const parsed = parseYaml(raw) as { phones: PhoneTarget[] };
  return parsed.phones;
});

export const loadLatest = readOnce((): LatestFile => {
  const raw = readFileSync(path.join(REPO_ROOT, "data", "latest.json"), "utf-8");
  return JSON.parse(raw) as LatestFile;
});

export const loadReference = readOnce((): ReferenceFile => {
  const raw = readFileSync(
    path.join(REPO_ROOT, "data", "reference", "cash-prices.json"),
    "utf-8",
  );
  const parsed = JSON.parse(raw) as Partial<ReferenceFile>;
  return {
    cashPrices: parsed.cashPrices ?? {},
    cheapestMonthly: parsed.cheapestMonthly ?? null,
    cashPriceSource: parsed.cashPriceSource ?? {},
    cashPriceCount: parsed.cashPriceCount ?? {},
    warnings: parsed.warnings ?? [],
    generatedAt: parsed.generatedAt ?? null,
  };
});
