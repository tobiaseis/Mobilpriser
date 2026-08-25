import { loadConfig } from "../config.js";
import { createGenericAdapter, type ProviderAdapter } from "./generic.js";

export function telenorAdapter(): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("telenor", config.urlsForProvider("telenor"));
}
