import { z } from "zod";

/**
 * Bindingsperioden er lovbestemt til maksimalt 6 måneder for danske
 * forbrugerabonnementer, og alle udbydere i dette projekt ligger på
 * maksimum. Det er derfor en konstant, ikke et felt der varierer pr. tilbud.
 */
export const BINDING_MONTHS = 6 as const;

export const ProviderIdSchema = z.enum([
  "yousee",
  "telenor",
  "telmore",
  "cbb",
  "callme",
  "norlys",
  // "3" ville være det rigtige navn, men et rent tal er upraktisk som
  // nøgle i id'er og filnavne. Vises som "3" i UI'et.
  "tre",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const PhoneTargetSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  storage: z.number().int().positive(),
  /** Site-uafhængig identifikator, fx "samsung-galaxy-s26-256gb". */
  slug: z.string().min(1),
});
export type PhoneTarget = z.infer<typeof PhoneTargetSchema>;

/**
 * Komponenterne bag mindsteprisen, brugt til at forklare tallet i UI'et og
 * til at krydstjekke det mod det tal, udbyderen selv oplyser. De er valgfri,
 * fordi ikke alle sider udstiller dem lige tydeligt.
 */
export const OfferComponentsSchema = z.object({
  upfront: z.number().min(0).max(25000).optional(),
  deviceMonthly: z.number().min(0).max(1500).optional(),
  planName: z.string().optional(),
  planMonthly: z.number().min(0).max(1500).optional(),
  campaignMonthly: z.number().min(0).max(1500).optional(),
  campaignMonths: z.number().int().min(0).max(BINDING_MONTHS).optional(),
  dataGb: z.union([z.number().positive(), z.literal("unlimited")]).optional(),
  setupFee: z.number().min(0).max(1000).optional(),
  shippingFee: z.number().min(0).max(500).optional(),
  addons: z.array(z.string()).optional(),
});
export type OfferComponents = z.infer<typeof OfferComponentsSchema>;

export const OfferSourceSchema = z.enum([
  "text-pattern",
  "json-ld",
  "next-data",
  "api",
  "dom",
  /** Regnet ud af komponenterne, fordi udbyderen ikke oplyser tallet. */
  "computed",
]);
export type OfferSource = z.infer<typeof OfferSourceSchema>;

export const OfferConfidenceSchema = z.enum(["high", "medium", "low"]);
export type OfferConfidence = z.infer<typeof OfferConfidenceSchema>;

/**
 * Et normaliseret tilbud: én udbyder × én telefonvariant × ét abonnement.
 *
 * `minPrice` er hovedtallet og det eneste, sammenligningen rangerer på:
 * mindsteprisen for de 6 måneders binding.
 *
 * `source` fortæller, hvor tallet kommer fra, og det er ikke en detalje.
 * De fleste udbydere oplyser mindsteprisen selv, og så er den læst direkte.
 * YouSee gør ikke, og der er tallet regnet ud af komponenterne
 * (`source: "computed"`) — det er mere skrøbeligt, fordi enhver komponent,
 * vi misforstår, forplanter sig til resultatet. Feltet hed tidligere
 * `statedMinPrice`, hvilket blev misvisende i det øjeblik et beregnet tal
 * kunne stå i det.
 */
export const OfferSchema = z.object({
  id: z.string().min(1),
  provider: ProviderIdSchema,
  phone: PhoneTargetSchema,
  url: z.string().url(),

  minPrice: z.number().min(500).max(30000),
  components: OfferComponentsSchema.default({}),
  /** udfyldes af beregningsmodellen ud fra `components`, når muligt. */
  computedMinPrice: z.number().min(0).max(30000).nullable().default(null),

  bindingMonths: z.literal(BINDING_MONTHS),

  scrapedAt: z.string().datetime(),
  source: OfferSourceSchema,
  confidence: OfferConfidenceSchema,
});
export type Offer = z.infer<typeof OfferSchema>;

/**
 * Referencen for "er det faktisk billigt": markedskontantpris for telefonen
 * plus det billigste SIM-only abonnement i samme databehov, i 6 måneder.
 */
export const ReferenceSchema = z.object({
  phoneSlug: z.string().min(1),
  cashPrice: z.number().min(500).max(30000),
  cheapestSimOnlyMonthly: z.number().min(0).max(500),
  dataGb: z.union([z.number().positive(), z.literal("unlimited")]),
  source: z.string(),
  scrapedAt: z.string().datetime(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const VerdictSchema = z.enum(["good", "neutral", "bad"]);
export type Verdict = z.infer<typeof VerdictSchema>;
