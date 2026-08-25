import {
  BINDING_MONTHS,
  OfferSchema,
  computeMinPriceFromComponents,
  type Offer,
} from "@mobilpriser/core";
import { loadConfig } from "../config.js";
import { extractJsonLd, fetchHtml as defaultFetchHtml, findProductLd, pageText } from "../html.js";
import { findPlanInText, loadPlans, type Plan } from "../plans.js";
import type { AdapterDeps, ProviderAdapter } from "./generic.js";

/**
 * YouSee oplyser ikke en samlet mindstepris for telefon + abonnement på
 * produktsiden. Det eneste "Mindstepris" på siden hører til tilbehør i en
 * "Andre har købt"-karrusel — derfor var det tal identisk på tværs af
 * telefoner, da det blev læst som telefonens.
 *
 * Til gengæld oplyser siden utvetydigt telefonens pris med abonnement, både
 * i teksten ("Tilbud 7.999 kr. 2.999 kr. Rabat 5.000 kr. Med 50 GB Mobil")
 * og i JSON-LD'ens Product.offers.price. Med abonnementets månedspris fra
 * config kan mindsteprisen regnes ud.
 *
 * Beregnede tal er mere skrøbelige end aflæste: en forkert månedspris
 * forplanter sig med 6 gange fejlen. Derfor markeres tilbuddene med lav
 * konfidens, komponenterne gemmes, så tallet kan efterprøves, og selve
 * regnestykket genbruger den testede formel i packages/core frem for at
 * blive skrevet forfra her.
 */
export function youseeAdapter(deps: Partial<AdapterDeps> = {}): ProviderAdapter {
  const config = loadConfig();
  const urlsBySlug = config.urlsForProvider("yousee");
  const fetchHtml = deps.fetchHtml ?? defaultFetchHtml;
  const plans = loadPlans("yousee");

  return {
    id: "yousee",

    discover(targets) {
      return targets
        .filter((target) => Boolean(urlsBySlug[target.slug]))
        .map((target) => ({ target, url: urlsBySlug[target.slug] }));
    },

    async scrape(ref) {
      const label = `yousee/${ref.target.slug}`;

      let html: string;
      try {
        html = await fetchHtml(ref.url);
      } catch (err) {
        return {
          offer: null,
          warning: `${label}: kunne ikke hente siden (${(err as Error).message})`,
        };
      }

      const phonePrice = readPhonePrice(html);
      if (phonePrice == null) {
        return {
          offer: null,
          warning: `${label}: fandt ingen telefonpris i JSON-LD (Product.offers.price)`,
        };
      }

      const text = pageText(html);
      const plan = findPlanInText(text, plans);
      if (!plan) {
        return {
          offer: null,
          warning:
            `${label}: kunne ikke afgøre hvilket abonnement tilbuddet gælder. ` +
            `Kendte abonnementer: ${plans.map((p) => p.name).join(", ") || "ingen i config/plans.yaml"}`,
        };
      }

      const components = {
        upfront: phonePrice,
        // YouSee sælger telefonen til tilbudsprisen frem for som en
        // månedlig ydelse, så der er ingen afbetaling i de 6 måneder.
        deviceMonthly: 0,
        planName: plan.name,
        planMonthly: plan.monthly,
        dataGb: dataGbFromPlanName(plan),
      };

      const minPrice = computeMinPriceFromComponents(components);
      if (minPrice == null) {
        return { offer: null, warning: `${label}: komponenterne rakte ikke til en beregning` };
      }

      const candidate: Offer = {
        id: `yousee:${ref.target.slug}`,
        provider: "yousee",
        phone: ref.target,
        url: ref.url,
        minPrice,
        components,
        computedMinPrice: minPrice,
        bindingMonths: BINDING_MONTHS,
        scrapedAt: new Date().toISOString(),
        source: "computed",
        confidence: "low",
      };

      const parsed = OfferSchema.safeParse(candidate);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          offer: null,
          warning: `${label}: beregnet tilbud (${minPrice} kr.) fejlede validering (${issues})`,
        };
      }

      return { offer: parsed.data };
    },
  };
}

/** Telefonens pris med abonnement, som YouSee oplyser den i JSON-LD. */
function readPhonePrice(html: string): number | null {
  const product = findProductLd(extractJsonLd(html));
  const offers = product?.offers as { price?: unknown } | undefined;
  if (!offers || typeof offers !== "object") return null;

  const raw = offers.price;
  const value = typeof raw === "number" ? raw : Number(String(raw));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/** "50 GB Mobil" → 50. "Fri Data Mobil" → ubegrænset. */
function dataGbFromPlanName(plan: Plan): number | "unlimited" | undefined {
  if (/fri data/i.test(plan.name)) return "unlimited";
  const gb = plan.name.match(/(\d+)\s*GB/i);
  return gb ? Number(gb[1]) : undefined;
}
