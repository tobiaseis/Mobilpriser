import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Offer } from "@mobilpriser/core";
import { closeBrowser } from "./browser.js";
import { loadConfig } from "./config.js";
import { allAdapters } from "./providers/index.js";
import { buildReference } from "./reference.js";
import { loadRetailers, scrapeRetailers } from "./retailers.js";
import { dropCrossModelDuplicates } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const LATEST_PATH = path.join(DATA_DIR, "latest.json");
const HISTORY_DIR = path.join(DATA_DIR, "history");
const HISTORY_JSONL_PATH = path.join(DATA_DIR, "history.jsonl");

/** Høflighedspause mellem hvert sidehent, jf. planens afsnit om god opførsel. */
const REQUEST_DELAY_MS = 1000;

type StaleOffer = Offer & { stale?: true };

interface LatestFile {
  generatedAt: string;
  offers: StaleOffer[];
  warnings: string[];
}

function loadPreviousLatest(): LatestFile | null {
  if (!existsSync(LATEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LATEST_PATH, "utf-8")) as LatestFile;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const config = loadConfig();
  const adapters = allAdapters();

  const freshOffers: Offer[] = [];
  const warnings: string[] = [];

  for (const adapter of adapters) {
    const refs = adapter.discover(config.phones);
    if (refs.length === 0) {
      warnings.push(`${adapter.id}: ingen telefoner konfigureret med URL endnu`);
      continue;
    }
    for (const ref of refs) {
      const result = await adapter.scrape(ref);
      if (result.offer) freshOffers.push(result.offer);
      if (result.warning) warnings.push(result.warning);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Et beløb, der er ens på tværs af modeller hos samme udbyder, hører til
  // siden og ikke til telefonen. Det kasseres, før det kan nå sitet.
  const validated = dropCrossModelDuplicates(freshOffers);
  warnings.push(...validated.warnings);
  const acceptedOffers = validated.kept;

  // Fejler en udbyder i dag, beholder vi gårsdagens tal for det tilbud
  // frem for at lade det forsvinde fra sitet — men markerer det tydeligt.
  const previous = loadPreviousLatest();
  const previousById = new Map((previous?.offers ?? []).map((offer) => [offer.id, offer]));
  const freshIds = new Set(acceptedOffers.map((offer) => offer.id));

  const carriedOver: StaleOffer[] = [];
  for (const [id, old] of previousById) {
    if (!freshIds.has(id)) {
      carriedOver.push({ ...old, stale: true });
      warnings.push(`${id}: intet nyt tilbud i dag — beholder gårsdagens data (markeret stale)`);
    }
  }

  const offers: StaleOffer[] = [...acceptedOffers, ...carriedOver];
  const generatedAt = new Date().toISOString();
  const dateStamp = generatedAt.slice(0, 10);

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });

  const latest: LatestFile = { generatedAt, offers, warnings };
  const serialized = JSON.stringify(latest, null, 2) + "\n";
  writeFileSync(LATEST_PATH, serialized);
  writeFileSync(path.join(HISTORY_DIR, `${dateStamp}.json`), serialized);

  // Referencen hentes hos forhandlerne, ikke hos udbyderne: en udbyders
  // egen kontantpris ligger over detailhandlens og ville få ethvert
  // abonnementstilbud til at se bedre ud, end det er.
  const retailerResult = await scrapeRetailers(loadRetailers(), {
    delay: () => sleep(REQUEST_DELAY_MS),
  });
  warnings.push(...retailerResult.warnings);
  const reference = buildReference(retailerResult.prices, acceptedOffers);
  mkdirSync(path.join(DATA_DIR, "reference"), { recursive: true });
  writeFileSync(
    path.join(DATA_DIR, "reference", "cash-prices.json"),
    JSON.stringify(reference, null, 2) + "\n",
  );

  const jsonlLines = offers
    .filter((offer) => !offer.stale)
    .map((offer) =>
      JSON.stringify({ date: dateStamp, id: offer.id, minPrice: offer.minPrice }),
    );
  if (jsonlLines.length > 0) {
    appendFileSync(HISTORY_JSONL_PATH, jsonlLines.join("\n") + "\n");
  }

  console.log(
    `Hentede ${acceptedOffers.length} tilbud, ${carriedOver.length} videreført fra i går (stale). ` +
      `Kontantpriser for ${Object.keys(reference.cashPrices).length} telefon(er).`,
  );
  if (warnings.length > 0) {
    console.log("\nAdvarsler:");
    for (const warning of warnings) console.log(`  - ${warning}`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## Mobilpriser — dagens indsamling",
      "",
      `- Hentede tilbud: **${acceptedOffers.length}**`,
      `- Videreført fra i går (stale): **${carriedOver.length}**`,
      `- Advarsler: **${warnings.length}**`,
      `- Kontantpriser opsamlet: **${Object.keys(reference.cashPrices).length}** telefon(er)`,
    ];
    if (warnings.length > 0) {
      lines.push("", "### Advarsler", "", ...warnings.map((warning) => `- ${warning}`));
    }
    appendFileSync(summaryPath, lines.join("\n") + "\n");
  }
}

run()
  .catch((err: unknown) => {
    console.error("Scraper fejlede uventet:", err);
    process.exitCode = 1;
  })
  .finally(closeBrowser);
