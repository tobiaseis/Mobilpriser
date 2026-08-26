/**
 * Datamodellen, som websitet læser den, uden noget der rører filsystemet.
 *
 * Den ligger for sig, fordi både serverkomponenter og browserkomponenter
 * har brug for den. Lå den sammen med indlæsningen i data.ts, ville en
 * enkelt import af PROVIDER_NAMES fra en "use client"-fil trække node:fs
 * med sig ind i browserbundtet.
 */

export type ProviderId =
  | "yousee"
  | "telenor"
  | "telmore"
  | "cbb"
  | "callme"
  | "norlys"
  | "tre";

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
  /** Laveste forhandlerpris pr. telefon — fra PriceRunner, Elgiganten m.fl., ikke fra udbyderne. */
  cashPrices: Record<string, number>;
  /** Laveste månedspris set på tværs af alle tilbud. */
  cheapestMonthly: number | null;
  cashPriceSource: Record<string, string>;
  cashPriceCount: Record<string, number>;
  warnings: string[];
  generatedAt: string | null;
}

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  yousee: "YouSee",
  telenor: "Telenor",
  telmore: "Telmore",
  cbb: "CBB",
  callme: "Call me",
  norlys: "Norlys",
  tre: "3",
};

export function offersForPhone(offers: Offer[], slug: string): Offer[] {
  return offers
    .filter((offer) => offer.phone.slug === slug)
    .sort((a, b) => a.minPrice - b.minPrice);
}

/**
 * Forhandlerne, referenceprisen kan komme fra. Navnene står også i
 * config/retailers.yaml, men den fil læses af scraperen med filsystemet og
 * kan ikke nå browseren — og et råt id på siden ("pricerunner") er ikke et
 * navn, nogen har skrevet.
 */
const RETAILER_NAMES: Record<string, string> = {
  pricerunner: "PriceRunner",
  elgiganten: "Elgiganten",
  power: "POWER",
  oister: "OiSTER",
  proshop: "Proshop",
};

export function retailerName(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return RETAILER_NAMES[id] ?? id;
}
