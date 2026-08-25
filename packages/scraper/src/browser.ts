import { chromium, type Browser } from "playwright";
import { USER_AGENT } from "./html.js";

/**
 * Nogle udbydere bygger produktsiden i browseren, så prisen slet ikke
 * findes i den HTML, serveren udleverer. Call me's side er 158.000 tegn
 * HTML, men kun 3.200 tegn synlig tekst — udelukkende menupunkter.
 *
 * Der bruges samme ærlige User-Agent som ved almindelig hentning. Formålet
 * er at få siden tegnet færdig, ikke at ligne en anden klient, end vi er.
 */

const NAVIGATION_TIMEOUT_MS = 30000;
/** Kort ekstra pause efter networkidle, så sen hydrering når at skrive prisen. */
const SETTLE_MS = 1500;

let shared: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!shared) {
    // I CI installeres den Chromium, Playwright selv forventer. Nogle
    // udviklingsmiljøer har en anden version liggende — den kan peges på
    // med PLAYWRIGHT_CHROMIUM_EXECUTABLE frem for at hente en ny.
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
    shared = await chromium.launch({ executablePath, args: ["--disable-dev-shm-usage"] });
  }
  return shared;
}

export async function closeBrowser(): Promise<void> {
  if (shared) {
    await shared.close();
    shared = null;
  }
}

export async function fetchRenderedHtml(url: string): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "da-DK",
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    if (response && !response.ok()) {
      throw new Error(`HTTP ${response.status()} for ${url}`);
    }
    // networkidle kan aldrig indtræffe på sider med løbende baggrundskald,
    // så en timeout her er ikke en fejl — siden er som regel tegnet alligevel.
    await page
      .waitForLoadState("networkidle", { timeout: NAVIGATION_TIMEOUT_MS })
      .catch(() => undefined);
    await page.waitForTimeout(SETTLE_MS);
    return await page.content();
  } finally {
    await context.close();
  }
}
