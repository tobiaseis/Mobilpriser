import { appendFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import {
  extractJsonLd,
  extractNextData,
  fetchPage,
  findMinPriceCandidates,
  findProductLd,
  isPlausibleMinPrice,
  pageText,
  pageTitle,
} from "./html.js";
import { allAdapters } from "./providers/index.js";

/**
 * Rapporterer hvad der faktisk står på udbydernes sider.
 *
 * Scraperen kan ikke fejlfindes fra et miljø, der ikke kan nå siderne, og
 * "fandt ingen mindstepris" alene siger ikke, om ordlyden er en anden, om
 * prisen indlæses med JavaScript, eller om siden slet ikke er den, vi tror.
 * Denne kommando henter siderne og skriver det, en fejlfinding har brug for.
 */

const REQUEST_DELAY_MS = 1000;
const CONTEXT_CHARS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Report {
  lines: string[];
}

function report(out: Report, line = ""): void {
  out.lines.push(line);
}

async function diagnoseUrl(out: Report, label: string, url: string): Promise<void> {
  report(out, `### ${label}`);
  report(out);
  report(out, `URL: ${url}`);

  let html: string;
  try {
    const result = await fetchPage(url);
    html = result.html;
    report(out, `HTTP: ${result.status}, ${html.length} tegn HTML`);
  } catch (err) {
    report(out, `**Hentning fejlede:** ${(err as Error).message}`);
    report(out);
    return;
  }

  const text = pageText(html);
  report(out, `Sidetitel: ${pageTitle(html) ?? "(ingen)"}`);
  report(out, `Synlig tekst: ${text.length} tegn`);

  const jsonLd = extractJsonLd(html);
  const product = findProductLd(jsonLd);
  report(
    out,
    `JSON-LD: ${jsonLd.length} node(r)${product ? `, Product fundet ("${String(product.name ?? "?")}")` : ", ingen Product"}`,
  );
  report(out, `__NEXT_DATA__: ${extractNextData(html) ? "til stede" : "ikke til stede"}`);

  // Er ordet der overhovedet? Skelner mellem "forkert ordlyd" og
  // "prisen findes først efter JavaScript-kørsel".
  const occurrences = text.match(/mindstepris/gi)?.length ?? 0;
  report(out, `Ordet "mindstepris" i teksten: ${occurrences} gang(e)`);

  const candidates = findMinPriceCandidates(html);
  if (candidates.length > 0) {
    report(out);
    report(out, "Beløb fundet nær ordet:");
    for (const c of candidates.slice(0, 8)) {
      const flags = [
        c.perMonth ? "pr. md." : null,
        isPlausibleMinPrice(c.value) ? null : "uden for fornuftsgrænser",
      ]
        .filter(Boolean)
        .join(", ");
      report(out, `- **${c.value} kr.**${flags ? ` (${flags})` : ""} — "${c.context}"`);
    }
  }

  if (occurrences > 0 && candidates.length === 0) {
    const idx = text.toLowerCase().indexOf("mindstepris");
    report(out);
    report(out, "Ordet findes, men intet beløb blev genkendt. Tekst omkring det:");
    report(out, "```");
    report(out, text.slice(Math.max(0, idx - 60), idx + CONTEXT_CHARS));
    report(out, "```");
  }

  if (occurrences === 0) {
    // Uden ordet er det mest nyttige at se, om der overhovedet er priser
    // på siden — er der ingen, indlæses de sandsynligvis med JavaScript.
    const amounts = text.match(/\d[\d.]*(?:,\d{1,2})?\s*kr\b/gi) ?? [];
    const unique = [...new Set(amounts)].slice(0, 12);
    report(out);
    report(
      out,
      unique.length > 0
        ? `Andre beløb på siden (${amounts.length} i alt): ${unique.join(", ")}`
        : "Ingen beløb overhovedet på siden — prisen indlæses sandsynligvis med JavaScript.",
    );
    report(out);
    report(out, "Første 300 tegn synlig tekst:");
    report(out, "```");
    report(out, text.slice(0, 300));
    report(out, "```");
  }

  report(out);
}

async function run(): Promise<void> {
  const config = loadConfig();
  const out: Report = { lines: [] };

  report(out, "## Mobilpriser — diagnose af udbydersider");
  report(out);

  for (const adapter of allAdapters()) {
    const refs = adapter.discover(config.phones);
    if (refs.length === 0) {
      report(out, `### ${adapter.id}`);
      report(out);
      report(out, "Ingen telefoner konfigureret med URL endnu.");
      report(out);
      continue;
    }
    for (const ref of refs) {
      await diagnoseUrl(out, `${adapter.id} / ${ref.target.slug}`, ref.url);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const text = out.lines.join("\n");
  console.log(text);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, text + "\n");
  }
}

run().catch((err: unknown) => {
  console.error("Diagnose fejlede uventet:", err);
  process.exitCode = 1;
});
