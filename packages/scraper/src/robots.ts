import { USER_AGENT } from "./html.js";

/**
 * Minimal robots.txt-læser.
 *
 * Planen og README har hele vejen lovet, at robots.txt respekteres, uden
 * at det var implementeret. Det er også den eneste måde at afgøre, om en
 * side som PriceRunner tillader os — deres data er deres produkt, og det
 * spørgsmål skal koden stille ved kørslen frem for at nogen gætter på det
 * i forvejen.
 *
 * Standarden er større end dette (wildcards, Crawl-delay, Sitemap), men
 * reglerne herunder dækker den beslutning, vi skal træffe: må vi hente
 * denne sti eller ej. Ved tvivl hentes ikke.
 */

/** Navnet vi optræder under i robots.txt — første token i vores User-Agent. */
const OUR_TOKEN = USER_AGENT.split("/")[0].toLowerCase();

interface Rule {
  path: string;
  allow: boolean;
}

export interface RobotsRules {
  rules: Rule[];
  /** Sat når robots.txt ikke kunne hentes eller forstås. */
  unknown?: boolean;
}

export function parseRobots(text: string): RobotsRules {
  const groups = new Map<string, Rule[]>();
  let currentAgents: string[] = [];
  let expectingAgents = true;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      // En ny agent efter regler starter en ny gruppe; flere agenter i
      // træk deler regelsæt.
      if (!expectingAgents) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      expectingAgents = true;
      continue;
    }

    if (field !== "allow" && field !== "disallow") continue;
    expectingAgents = false;

    for (const agent of currentAgents) {
      const rules = groups.get(agent) ?? [];
      // "Disallow:" uden værdi betyder udtrykkeligt: alt er tilladt.
      if (field === "disallow" && value === "") {
        rules.push({ path: "/", allow: true });
      } else if (value !== "") {
        rules.push({ path: value, allow: field === "allow" });
      }
      groups.set(agent, rules);
    }
  }

  const specific = groups.get(OUR_TOKEN);
  return { rules: specific ?? groups.get("*") ?? [] };
}

/**
 * Længste matchende sti vinder, og ved lige længde vinder Allow — som i
 * den gængse fortolkning af standarden.
 */
export function isAllowed(robots: RobotsRules, pathname: string): boolean {
  if (robots.unknown) return false;

  let best: Rule | null = null;
  for (const rule of robots.rules) {
    if (!pathname.startsWith(rule.path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

const cache = new Map<string, RobotsRules>();

export function clearRobotsCache(): void {
  cache.clear();
}

/**
 * Henter og husker robots.txt pr. domæne. Kan filen ikke hentes med en
 * rigtig fejl, betragtes siden som forbudt: at gætte på et ja er præcis
 * den antagelse, reglen findes for at undgå.
 */
export async function fetchRobots(
  origin: string,
  fetchText: (url: string) => Promise<string>,
): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached) return cached;

  let robots: RobotsRules;
  try {
    robots = parseRobots(await fetchText(`${origin}/robots.txt`));
  } catch (err) {
    // Ingen robots.txt (404) betyder efter standarden, at alt er tilladt.
    robots = /HTTP 40[34]/.test((err as Error).message)
      ? { rules: [] }
      : { rules: [], unknown: true };
  }

  cache.set(origin, robots);
  return robots;
}

export async function isUrlAllowed(
  url: string,
  fetchText: (url: string) => Promise<string>,
): Promise<boolean> {
  const parsed = new URL(url);
  const robots = await fetchRobots(parsed.origin, fetchText);
  return isAllowed(robots, parsed.pathname);
}
