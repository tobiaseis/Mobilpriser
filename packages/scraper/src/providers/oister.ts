import { loadConfig } from "../config.js";
import { createGenericAdapter, type AdapterDeps, type ProviderAdapter } from "./generic.js";

export function oisterAdapter(deps: Partial<AdapterDeps> = {}): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("oister", config.urlsForProvider("oister"), deps);
}
