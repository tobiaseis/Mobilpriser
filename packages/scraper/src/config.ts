import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  PhoneTargetSchema,
  ProviderIdSchema,
  type PhoneTarget,
  type ProviderId,
} from "@mobilpriser/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/ og dist/ ligger begge direkte under packages/scraper, så stien til
// repo-roden er den samme uanset om koden kører fra kilde eller build.
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "../../../config/phones.yaml");

interface RawConfig {
  phones: unknown[];
  providers: Record<string, { urls?: Record<string, string> }>;
}

export interface LoadedConfig {
  phones: PhoneTarget[];
  urlsForProvider(id: ProviderId): Record<string, string>;
}

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): LoadedConfig {
  const raw = parseYaml(readFileSync(configPath, "utf-8")) as RawConfig;
  const phones = raw.phones.map((p) => PhoneTargetSchema.parse(p));

  return {
    phones,
    urlsForProvider(id) {
      ProviderIdSchema.parse(id);
      return raw.providers[id]?.urls ?? {};
    },
  };
}
