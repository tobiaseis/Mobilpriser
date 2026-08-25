import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Offer } from "@mobilpriser/core";
import { closeBrowser } from "./browser.js";
import { loadConfig } from "./config.js";
import { allAdapters } from "./providers/index.js";

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

  // Fejler en udbyder i dag, beholder vi gårsdagens tal for det tilbud
  // frem for at lade det forsvinde fra sitet — men markerer det tydeligt.
  const previous = loadPreviousLatest();
  const previousById = new Map((previous?.offers ?? []).map((offer) => [offer.id, offer]));
  const freshIds = new Set(freshOffers.map((offer) => offer.id));

  const carriedOver: StaleOffer[] = [];
  for (const [id, old] of previousById) {
    if (!freshIds.has(id)) {
      carriedOver.push({ ...old, stale: true });
      warnings.push(`${id}: intet nyt tilbud i dag — beholder gårsdagens data (markeret stale)`);
    }
  }

  const offers: StaleOffer[] = [...freshOffers, ...carriedOver];
  const generatedAt = new Date().toISOString();
  const dateStamp = generatedAt.slice(0, 10);

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });

  const latest: LatestFile = { generatedAt, offers, warnings };
  const serialized = JSON.stringify(latest, null, 2) + "\n";
  writeFileSync(LATEST_PATH, serialized);
  writeFileSync(path.join(HISTORY_DIR, `${dateStamp}.json`), serialized);

  const jsonlLines = offers
    .filter((offer) => !offer.stale)
    .map((offer) =>
      JSON.stringify({ date: dateStamp, id: offer.id, statedMinPrice: offer.statedMinPrice }),
    );
  if (jsonlLines.length > 0) {
    appendFileSync(HISTORY_JSONL_PATH, jsonlLines.join("\n") + "\n");
  }

  console.log(
    `Hentede ${freshOffers.length} tilbud, ${carriedOver.length} videreført fra i går (stale).`,
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
      `- Hentede tilbud: **${freshOffers.length}**`,
      `- Videreført fra i går (stale): **${carriedOver.length}**`,
      `- Advarsler: **${warnings.length}**`,
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
