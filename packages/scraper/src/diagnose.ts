import { appendFileSync } from "node:fs";
import { closeBrowser, fetchRenderedHtml } from "./browser.js";
import { loadConfig } from "./config.js";
import {
  extractJsonLd,
  extractNextData,
  fetchPage,
  findMinPriceCandidates,
  findProductLd,
  isPlausibleMinPrice,
  looksClientRendered,
  looksOutOfStock,
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

/**
 * Ord, der står tæt på de tal, en mindstepris er sat sammen af. Skal en
 * udbyders mindstepris regnes ud frem for læses, er det disse afsnit, man
 * har brug for at se — og de er umulige at gætte sig til udefra.
 */
const PRICE_KEYWORDS =
  /(afbetaling|betal her og nu|kontant|udbetaling|oprettelse|pr\.? ?md|om måneden|i 6 mdr|bindingsperiode|abonnement)/gi;

const PRICE_CONTEXT_BEFORE = 70;
const PRICE_CONTEXT_AFTER = 150;
const MAX_PRICE_CONTEXTS = 10;

function reportPriceContext(out: Report, text: string): void {
  const windows: string[] = [];
  let coveredUntil = 0;

  PRICE_KEYWORDS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PRICE_KEYWORDS.exec(text)) !== null && windows.length < MAX_PRICE_CONTEXTS) {
    // Nøgleordene står tæt, så uden dette ville hvert vindue gentage det
    // forrige med få tegns forskydning og drukne rapporten.
    if (match.index < coveredUntil) continue;

    const start = Math.max(0, match.index - PRICE_CONTEXT_BEFORE);
    const end = match.index + PRICE_CONTEXT_AFTER;
    const snippet = text.slice(start, end).trim();
    // Kun afsnit med et beløb er interessante.
    if (!/\d[\d.]*\s*kr/i.test(snippet)) continue;

    windows.push(snippet);
    coveredUntil = end;
  }

  if (windows.length === 0) return;
  report(out);
  report(out, "Prisrelateret kontekst (til at regne mindsteprisen ud af komponenter):");
  for (const w of windows) {
    report(out, `- "${w}"`);
  }
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

  report(out, `Ser udsolgt ud: ${looksOutOfStock(html) ? "ja" : "nej"}`);
  reportPriceContext(out, text);

  // Står ordet i den rå HTML uden at være synligt, ligger prisen sandsynligvis
  // i en indlejret JSON-payload. Så kan den hentes uden browser — hurtigere og
  // mindre skrøbeligt — og det er værd at vide, før man griber til Playwright.
  const rawOccurrences = html.match(/mindstepris/gi)?.length ?? 0;
  if (rawOccurrences > occurrences) {
    report(out);
    report(
      out,
      `Ordet står ${rawOccurrences} gang(e) i den rå HTML mod ${occurrences} i den synlige tekst — prisen kan ligge i en indlejret payload.`,
    );
    const idx = html.toLowerCase().indexOf("mindstepris");
    report(out, "```");
    report(out, html.slice(Math.max(0, idx - 100), idx + 300).replace(/\s+/g, " "));
    report(out, "```");
  }

  // Bekræfter om en browser rent faktisk løser problemet, frem for at
  // gætte. Kun relevant når den serverleverede side hverken har prisen
  // eller nævneværdig tekst.
  if (candidates.length === 0 && looksClientRendered(html)) {
    report(out);
    report(out, "Siden ser klient-tegnet ud — prøver igen med browser:");
    try {
      const rendered = await fetchRenderedHtml(url);
      const renderedText = pageText(rendered);
      const renderedCandidates = findMinPriceCandidates(rendered);
      report(out, `- Synlig tekst efter gengivelse: ${renderedText.length} tegn`);
      report(
        out,
        `- Ordet "mindstepris": ${renderedText.match(/mindstepris/gi)?.length ?? 0} gang(e)`,
      );
      if (renderedCandidates.length > 0) {
        for (const c of renderedCandidates.slice(0, 8)) {
          report(out, `- **${c.value} kr.**${c.perMonth ? " (pr. md.)" : ""} — "${c.context}"`);
        }
      } else {
        const amounts = renderedText.match(/\d[\d.]*(?:,\d{1,2})?\s*kr\b/gi) ?? [];
        report(
          out,
          `- Stadig ingen mindstepris. Beløb på siden: ${[...new Set(amounts)].slice(0, 12).join(", ") || "ingen"}`,
        );
      }
    } catch (err) {
      report(out, `- Gengivelse fejlede: ${(err as Error).message}`);
    }
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

  // Med alle udbydere bliver rapporten lang. PROVIDER=yousee begrænser den
  // til én, så det, man faktisk undersøger, kan læses uden at scrolle.
  const only = process.env.PROVIDER?.trim().toLowerCase();
  // URL=<a>,<b> undersøger vilkårlige sider, også dem der er slået fra i
  // config — nødvendigt for at arbejde videre med en udbyder, hvis sider
  // ikke må indsamles endnu.
  const explicitUrls = (process.env.URL ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  report(out, "## Mobilpriser — diagnose af udbydersider");
  if (only) report(out, `\nBegrænset til: **${only}**`);
  report(out);

  if (explicitUrls.length > 0) {
    for (const url of explicitUrls) {
      await diagnoseUrl(out, url, url);
      await sleep(REQUEST_DELAY_MS);
    }
    finish(out);
    return;
  }

  for (const adapter of allAdapters()) {
    if (only && adapter.id !== only) continue;
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

  finish(out);
}

function finish(out: Report): void {
  const text = out.lines.join("\n");
  console.log(text);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, text + "\n");
  }
}

run()
  .catch((err: unknown) => {
    console.error("Diagnose fejlede uventet:", err);
    process.exitCode = 1;
  })
  .finally(closeBrowser);
