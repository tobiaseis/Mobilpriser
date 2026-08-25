import { loadConfig } from "../config.js";
import { createGenericAdapter, type AdapterDeps, type ProviderAdapter } from "./generic.js";

export function treAdapter(deps: Partial<AdapterDeps> = {}): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("tre", config.urlsForProvider("tre"), deps);
}
