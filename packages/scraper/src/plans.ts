import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { ProviderId } from "@mobilpriser/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLANS_PATH = path.resolve(__dirname, "../../../config/plans.yaml");

interface RawPlans {
  providers: Record<string, { plans?: Record<string, number> }>;
}

/** Abonnementets navn, som det står på siden, og prisen pr. måned. */
export interface Plan {
  name: string;
  monthly: number;
}

export function loadPlans(
  provider: ProviderId,
  plansPath: string = DEFAULT_PLANS_PATH,
): Plan[] {
  const raw = parseYaml(readFileSync(plansPath, "utf-8")) as RawPlans;
  const plans = raw.providers?.[provider]?.plans ?? {};
  return Object.entries(plans).map(([name, monthly]) => ({ name, monthly }));
}

/**
 * Finder det abonnement, en produktside binder tilbuddet til.
 *
 * Siderne skriver det som "Rabat 5.000 kr. Med 50 GB Mobil", så navnet
 * søges direkte i teksten frem for at parse sætningen. Findes flere navne,
 * returneres intet: at gætte hvilket der hører til telefonen ville lægge
 * en fejl på 6 x månedsprisen ind i mindsteprisen.
 */
export function findPlanInText(text: string, plans: Plan[]): Plan | null {
  const haystack = text.toLowerCase();
  const found = plans.filter((plan) => haystack.includes(plan.name.toLowerCase()));
  return found.length === 1 ? found[0] : null;
}
