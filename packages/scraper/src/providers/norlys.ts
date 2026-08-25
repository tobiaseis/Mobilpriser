import { loadConfig } from "../config.js";
import { createGenericAdapter, type AdapterDeps, type ProviderAdapter } from "./generic.js";

export function norlysAdapter(deps: Partial<AdapterDeps> = {}): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("norlys", config.urlsForProvider("norlys"), deps);
}
