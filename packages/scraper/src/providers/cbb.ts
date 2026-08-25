import { loadConfig } from "../config.js";
import { createGenericAdapter, type ProviderAdapter } from "./generic.js";

export function cbbAdapter(): ProviderAdapter {
  const config = loadConfig();
  return createGenericAdapter("cbb", config.urlsForProvider("cbb"));
}
