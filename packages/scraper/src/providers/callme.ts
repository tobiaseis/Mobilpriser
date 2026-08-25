import { loadConfig } from "../config.js";
import { createGenericAdapter, type ProviderAdapter } from "./generic.js";

export function callmeAdapter(): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("callme", config.urlsForProvider("callme"));
}
