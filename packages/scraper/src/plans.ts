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
 * Siden siger det selv med ordet "Med": "Rabat 5.000 kr. Med 50 GB Mobil".
 * Den formulering søges først, fordi den udpeger netop det abonnement,
 * prisen forudsætter. Et opslag i hele teksten duer ikke alene — siderne
 * nævner også de øvrige abonnementer i en vælger, og så ville et krav om
 * ét entydigt fund afvise en side, der faktisk oplyser svaret tydeligt.
 *
 * Kan det stadig ikke afgøres, returneres intet. At gætte ville lægge en
 * fejl på 6 x forskellen i månedspris ind i mindsteprisen.
 */
export function findPlanInText(text: string, plans: Plan[]): Plan | null {
  const haystack = text.toLowerCase();

  const boundToOffer = plans.filter((plan) =>
    haystack.includes(`med ${plan.name.toLowerCase()}`),
  );
  if (boundToOffer.length === 1) return boundToOffer[0];

  const mentioned = plans.filter((plan) => haystack.includes(plan.name.toLowerCase()));
  return mentioned.length === 1 ? mentioned[0] : null;
}
