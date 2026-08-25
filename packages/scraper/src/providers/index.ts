import type { ProviderAdapter } from "./generic.js";
import { callmeAdapter } from "./callme.js";
import { cbbAdapter } from "./cbb.js";
import { telenorAdapter } from "./telenor.js";
import { telmoreAdapter } from "./telmore.js";
import { youseeAdapter } from "./yousee.js";

export type { ProductRef, ProviderAdapter, ScrapeResult } from "./generic.js";

/** Alle udbyder-adaptere i den rækkefølge, de nævnes i planen. */
export function allAdapters(): ProviderAdapter[] {
  return [
    youseeAdapter(),
    telenorAdapter(),
    telmoreAdapter(),
    cbbAdapter(),
    callmeAdapter(),
  ];
}
