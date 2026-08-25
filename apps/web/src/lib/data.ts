import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * Data læses fra repo-rodens data/ og config/ mapper — websitet er
 * udelukkende en visning af, hvad den daglige scraper allerede har skrevet
 * og committet. Der sker aldrig kald til udbydernes sider herfra.
 */
const REPO_ROOT = path.join(process.cwd(), "..", "..");

export type ProviderId = "yousee" | "telenor" | "telmore" | "cbb" | "callme";

export interface PhoneTarget {
  brand: string;
  model: string;
  storage: number;
  slug: string;
}

export interface OfferComponents {
  upfront?: number;
  deviceMonthly?: number;
  planName?: string;
  planMonthly?: number;
  campaignMonthly?: number;
  campaignMonths?: number;
  dataGb?: number | "unlimited";
  setupFee?: number;
  shippingFee?: number;
  addons?: string[];
}

export interface Offer {
  id: string;
  provider: ProviderId;
  phone: PhoneTarget;
  url: string;
  minPrice: number;
  components: OfferComponents;
  computedMinPrice: number | null;
  bindingMonths: 6;
  scrapedAt: string;
  source: string;
  confidence: "high" | "medium" | "low";
  /** Sat af scraperen, når dagens kørsel ikke kunne opdatere tilbuddet. */
  stale?: boolean;
}

export interface LatestFile {
  generatedAt: string | null;
  offers: Offer[];
  warnings: string[];
}

export interface ReferenceFile {
  cashPrices: Record<string, number>;
  cheapestSimOnlyByDataGb: Record<string, number>;
}

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
    cheapestSimOnlyByDataGb: parsed.cheapestSimOnlyByDataGb ?? {},
  };
}

export function offersForPhone(offers: Offer[], slug: string): Offer[] {
  return offers
    .filter((offer) => offer.phone.slug === slug)
    .sort((a, b) => a.minPrice - b.minPrice);
}

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  yousee: "YouSee",
  telenor: "Telenor",
  telmore: "Telmore",
  cbb: "CBB",
  callme: "Call me",
};
