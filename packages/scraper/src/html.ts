import { parse as parseHtml } from "node-html-parser";

/**
 * Ærlig User-Agent med link til projektet, som beskrevet i planens afsnit
 * om god opførsel — ingen forsøg på at udgive sig for en almindelig browser.
 */
export const USER_AGENT =
  "Mobilpriser-bot/1.0 (+https://github.com/tobiaseis/Mobilpriser; " +
  "ikke-kommercielt prissammenligningsprojekt, én kørsel i døgnet)";

export interface FetchResult {
  html: string;
  status: number;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      // Almindelige, korrekte forespørgselsheadere. Nogle servere afviser
      // requests helt uden Accept — det er ikke et forsøg på at ligne en
      // browser, blot en velformet forespørgsel.
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "da-DK,da;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return { html: await response.text(), status: response.status };
}

export async function fetchHtml(url: string): Promise<string> {
  return (await fetchPage(url)).html;
}

/**
 * Sidens synlige tekst, med HTML-entiteter afkodet.
 *
 * Det er vigtigere, end det lyder: danske prissider skriver rutinemæssigt
 * "4.499&nbsp;kr.", og strippes tags med et regex i stedet for at parse
 * dokumentet, står entiteten tilbage som rå tekst midt i beløbet. Så
 * matcher et mønster som "beløb efterfulgt af kr" ikke — eller værre,
 * det backtracker og rammer et helt andet tal på siden.
 */
export function pageText(html: string): string {
  const root = parseHtml(html);
  for (const el of root.querySelectorAll("script, style, noscript")) {
    el.remove();
  }
  return root.textContent
    .replace(/<!doctype[^>]*>/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dansk beløbsformat: "4.499", "4.499,00" eller "4499". Rundes til hele kroner. */
export function parseDanishAmount(raw: string): number | null {
  const withoutOere = raw.replace(/,\d{1,2}$/, "");
  const digitsOnly = withoutOere.replace(/\D/g, "");
  if (!digitsOnly) return null;
  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : null;
}

/**
 * Beløb skrevet enten som "4.499 kr." eller "kr. 4.499" — begge former
 * er almindelige på danske sider.
 */
const AMOUNT_PATTERN =
  /(?:kr\.?|DKK)\s*(\d[\d.]*(?:,\d{1,2})?)|(\d[\d.]*(?:,\d{1,2})?)\s*(?:kr\b|kr\.|DKK)/gi;

/**
 * Markerer et beløb som en månedsydelse frem for en samlet pris.
 * Skal tåle den afsluttende tegnsætning fra beløbet selv, som i
 * "299 kr./md." hvor der står "." før skråstregen.
 */
const PER_MONTH_PATTERN = /^[.\s]*(?:\/|pr\.?\s*|om\s+)?\s*(?:md\b|mdr\b|måned)/i;

export interface MinPriceCandidate {
  value: number;
  /** Teksten omkring fundet, så en fejlfinding kan se hvad der blev læst. */
  context: string;
  /** True hvis beløbet er efterfulgt af "/md.", "pr. måned" e.l. */
  perMonth: boolean;
}

const MINDSTEPRIS_WINDOW = 160;

/**
 * Finder alle beløb, der står i nærheden af ordet "mindstepris".
 *
 * Danske udbydere er forpligtet til at oplyse en mindstepris for
 * bindingsperioden, men formuleringen varierer ("Mindstepris for 6 mdr.",
 * "Samlet mindstepris", "Mindsteprisen er"), og der kan stå andre beløb i
 * samme sætning — typisk en månedsydelse. Derfor returneres alle fund, så
 * kalderen kan vælge og fejlfinding kan se, hvad der faktisk stod.
 */
export function findMinPriceCandidates(html: string): MinPriceCandidate[] {
  const text = pageText(html);
  const candidates: MinPriceCandidate[] = [];
  const mindsteprisPattern = /mindstepris/gi;

  let occurrence: RegExpExecArray | null;
  while ((occurrence = mindsteprisPattern.exec(text)) !== null) {
    const window = text.slice(occurrence.index, occurrence.index + MINDSTEPRIS_WINDOW);

    AMOUNT_PATTERN.lastIndex = 0;
    let amount: RegExpExecArray | null;
    while ((amount = AMOUNT_PATTERN.exec(window)) !== null) {
      const value = parseDanishAmount(amount[1] ?? amount[2]);
      if (value == null) continue;

      const after = window.slice(amount.index + amount[0].length);
      candidates.push({
        value,
        context: window.slice(0, 120).trim(),
        perMonth: PER_MONTH_PATTERN.test(after),
      });
    }
  }

  return candidates;
}

/** Fornuftsgrænser for en mindstepris — samme som i core-schemaet. */
const MIN_PLAUSIBLE = 500;
const MAX_PLAUSIBLE = 30000;

export function isPlausibleMinPrice(value: number): boolean {
  return value >= MIN_PLAUSIBLE && value <= MAX_PLAUSIBLE;
}

/**
 * Den mindstepris, udbyderen selv oplyser. Vælger det første beløb nær
 * ordet "mindstepris", der ikke er en månedsydelse og ligger inden for
 * fornuftsgrænserne.
 */
export function extractStatedMinPrice(html: string): number | null {
  const candidate = findMinPriceCandidates(html).find(
    (c) => !c.perMonth && isPlausibleMinPrice(c.value),
  );
  return candidate?.value ?? null;
}

/** Finder og parser alle <script type="application/ld+json"> blokke. */
export function extractJsonLd(html: string): unknown[] {
  const root = parseHtml(html);
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  const nodes: unknown[] = [];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // ugyldig JSON-LD-blok — spring over frem for at fejle hele hentningen
    }
    if (Array.isArray(parsed)) {
      nodes.push(...parsed);
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "@graph" in parsed &&
      Array.isArray((parsed as { "@graph": unknown[] })["@graph"])
    ) {
      nodes.push(...(parsed as { "@graph": unknown[] })["@graph"]);
    } else {
      nodes.push(parsed);
    }
  }

  return nodes;
}

function hasProductType(node: unknown): boolean {
  if (!node || typeof node !== "object" || !("@type" in node)) return false;
  const type = (node as { "@type": unknown })["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
}

/** Finder den første JSON-LD-node af typen Product, hvis nogen. */
export function findProductLd(nodes: unknown[]): Record<string, unknown> | undefined {
  return nodes.find(hasProductType) as Record<string, unknown> | undefined;
}

/** Henter og parser indholdet af `<script id="__NEXT_DATA__">`, hvis til stede. */
export function extractNextData(html: string): unknown | null {
  const root = parseHtml(html);
  const el = root.querySelector("#__NEXT_DATA__");
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

/** Sidens <title>, brugt i diagnosticering. */
export function pageTitle(html: string): string | null {
  const root = parseHtml(html);
  return root.querySelector("title")?.textContent?.trim() ?? null;
}

/**
 * Telmore viser "Mindstepris i 6 måneder 0 kr. Udsolgt" på en udsolgt
 * telefon. Nul kroner er altså ikke en parserfejl — der er bare ikke
 * noget tilbud at hente. Det skal rapporteres som en lagerstatus, ikke
 * som en knækket parser, ellers jager man en fejl, der ikke findes.
 */
const OUT_OF_STOCK_PATTERN = /\b(udsolgt|ikke på lager|midlertidigt udsolgt)\b/i;

export function looksOutOfStock(html: string): boolean {
  return OUT_OF_STOCK_PATTERN.test(pageText(html));
}

/**
 * Sider, der bygger indholdet i browseren, udleverer meget HTML men næsten
 * ingen synlig tekst. Bruges til at afgøre, om det er værd at hente siden
 * igen med en rigtig browser.
 */
export function looksClientRendered(html: string): boolean {
  return pageText(html).length < 5000;
}
