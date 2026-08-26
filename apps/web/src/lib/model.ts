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

export interface PhoneOfferSummary {
  cheapest: Offer;
  dearest: Offer;
  count: number;
}

/**
 * Billigste og dyreste tilbud pr. telefon, i ét gennemløb af listen.
 *
 * Forsiden skal bruge begge dele: det billigste tilbud til hvert kort, og
 * spændet mellem billigst og dyrest til overskriften. Gjort hver for sig
 * blev den samme liste filtreret og sorteret igennem to gange pr. telefon.
 * Her er der hverken filtrering eller sortering — kun en sammenligning pr.
 * tilbud, for yderpunkterne er alt, der spørges om.
 */
export function summariseOffers(offers: Offer[]): Map<string, PhoneOfferSummary> {
  const bySlug = new Map<string, PhoneOfferSummary>();

  for (const offer of offers) {
    const summary = bySlug.get(offer.phone.slug);
    if (summary === undefined) {
      bySlug.set(offer.phone.slug, { cheapest: offer, dearest: offer, count: 1 });
      continue;
    }
    if (offer.minPrice < summary.cheapest.minPrice) summary.cheapest = offer;
    if (offer.minPrice > summary.dearest.minPrice) summary.dearest = offer;
    summary.count++;
  }

  return bySlug;
}

/**
 * Netop de felter, sammenligningstabellen viser — fladt, uden det
 * scraperen ellers noterer sig.
 *
 * Alt, hvad en serverkomponent rækker videre til en browserkomponent,
 * bliver skrevet ind i sidens HTML. Hele Offer indeholder blandt andet en
 * kopi af telefonen for hvert eneste tilbud, et krydstjekket tal og et
 * tidsstempel, som ingen af delene står nogen steder på siden. De blev
 * sendt med alligevel, og betalt for i indlæsningstid.
 */
export interface ComparisonOffer {
  id: string;
  provider: ProviderId;
  url: string;
  minPrice: number;
  planName: string | null;
  dataGb: number | "unlimited" | null;
  upfront: number | null;
  planMonthly: number | null;
  setupFee: number | null;
  /** Udbyderen oplyser ikke selv en samlet mindstepris; tallet er regnet ud. */
  computed: boolean;
  /** Dagens kørsel kunne ikke opdatere tilbuddet. */
  stale: boolean;
}

export function toComparisonOffers(offers: Offer[]): ComparisonOffer[] {
  return offers.map((offer) => ({
    id: offer.id,
    provider: offer.provider,
    url: offer.url,
    minPrice: offer.minPrice,
    planName: offer.components.planName ?? null,
    dataGb: offer.components.dataGb ?? null,
    upfront: offer.components.upfront ?? null,
    planMonthly: offer.components.planMonthly ?? null,
    setupFee: offer.components.setupFee ?? null,
    computed: offer.source === "computed",
    stale: offer.stale === true,
  }));
}

/** Én telefon, som forsidens kort viser den. */
export interface PhoneCard {
  slug: string;
  brand: string;
  model: string;
  storage: number;
  /** Billigste mindstepris, eller null når der ikke er hentet tilbud endnu. */
  minPrice: number | null;
  /** Udbyderens visningsnavn — allerede slået op, så tabellen ikke skal med. */
  provider: string | null;
  /** Forhandlerprisen at måle imod, eller null når den mangler. */
  cashPrice: number | null;
}

export function toPhoneCards(
  phones: PhoneTarget[],
  summaries: Map<string, PhoneOfferSummary>,
  cashPrices: Record<string, number>,
): PhoneCard[] {
  return phones.map((phone) => {
    const cheapest = summaries.get(phone.slug)?.cheapest;
    return {
      slug: phone.slug,
      brand: phone.brand,
      model: phone.model,
      storage: phone.storage,
      minPrice: cheapest?.minPrice ?? null,
      provider: cheapest ? PROVIDER_NAMES[cheapest.provider] : null,
      cashPrice: cashPrices[phone.slug] ?? null,
    };
  });
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
