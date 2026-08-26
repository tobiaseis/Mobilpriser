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

export function loadPhones(): PhoneTarget[] {
  const raw = readFileSync(path.join(REPO_ROOT, "config", "phones.yaml"), "utf-8");
  const parsed = parseYaml(raw) as { phones: PhoneTarget[] };
  return parsed.phones;
}

export function loadLatest(): LatestFile {
  const raw = readFileSync(path.join(REPO_ROOT, "data", "latest.json"), "utf-8");
  return JSON.parse(raw) as LatestFile;
}

export function loadReference(): ReferenceFile {
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
}
