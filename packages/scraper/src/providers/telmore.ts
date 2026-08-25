import { loadConfig } from "../config.js";
import { createGenericAdapter, type ProviderAdapter } from "./generic.js";

export function telmoreAdapter(): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("telmore", config.urlsForProvider("telmore"));
}
