import { loadConfig } from "../config.js";
import { createGenericAdapter, type ProviderAdapter } from "./generic.js";

export function youseeAdapter(): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("yousee", config.urlsForProvider("yousee"));
}
