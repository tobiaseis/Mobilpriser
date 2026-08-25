import { parse as parseHtml } from "node-html-parser";

/**
 * Ærlig User-Agent med link til projektet, som beskrevet i planens afsnit
 * om god opførsel — ingen forsøg på at udgive sig for en almindelig browser.
 */
const USER_AGENT =
  "Mobilpriser-bot/1.0 (+https://github.com/tobiaseis/Mobilpriser; " +
  "ikke-kommercielt prissammenligningsprojekt, én kørsel i døgnet)";

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "da-DK,da;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

/**
 * Finder og parser alle <script type="application/ld+json"> blokke.
 * Udfolder både arrays og @graph-strukturer til én flad liste af noder.
 */
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
      continue; // ugyldig JSON-LD-blok — spring den over frem for at fejle hele hentningen
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

/**
 * Dansk beløbsformat: "4.499", "4.499,00" eller bare "4499". Punktum er
 * tusindtalsseparator, komma er decimalseparator. Vi runder til hele kroner.
 */
function parseDanishAmount(raw: string): number | null {
  let s = raw.trim();
  const oereMatch = s.match(/,(\d{2})$/);
  if (oereMatch) {
    s = s.slice(0, s.length - oereMatch[0].length);
  }
  const digitsOnly = s.replace(/\D/g, "");
  if (!digitsOnly) return null;
  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : null;
}

const MINDSTEPRIS_PATTERN = /mindstepris[\s\S]{0,60}?(\d[\d.,\s]{0,12}\d|\d)\s*kr/i;

/**
 * Henter den mindstepris, udbyderen selv oplyser på siden. Dansk
 * lovgivning kræver, at forbrugerabonnementer med binding oplyser dette
 * tal, så det er den primære — og mest robuste — kilde til sammenligning.
 */
export function extractStatedMinPrice(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ");
  const match = text.match(MINDSTEPRIS_PATTERN);
  if (!match) return null;
  return parseDanishAmount(match[1]);
}
