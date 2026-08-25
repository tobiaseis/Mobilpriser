import type { Offer } from "@mobilpriser/core";

export interface ValidationResult {
  kept: Offer[];
  warnings: string[];
}

/**
 * Kasserer priser, som den samme udbyder oplyser identisk for flere
 * forskellige telefoner.
 *
 * Baggrunden er konkret: YouSee-siderne gav 1.813 kr. for både Galaxy S26
 * og S26 Ultra — to telefoner med tusindvis af kroners forskel. Et beløb,
 * der er ens på tværs af modeller, hører ikke til produktet, men til noget
 * generisk på siden (et abonnementsbanner, en anbefalingskarrusel), og det
 * er præcis den slags tal, der ser troværdigt ud i en tabel og gør
 * sammenligningen forkert.
 *
 * Tvivlen kommer sammenligningen til gode: hellere et hul med en tydelig
 * advarsel end et forkert tal, der udpeger den forkerte udbyder som
 * billigst.
 */
export function dropCrossModelDuplicates(offers: Offer[]): ValidationResult {
  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    const key = `${offer.provider}:${offer.statedMinPrice}`;
    groups.set(key, [...(groups.get(key) ?? []), offer]);
  }

  const kept: Offer[] = [];
  const warnings: string[] = [];

  for (const group of groups.values()) {
    const distinctPhones = new Set(group.map((offer) => offer.phone.slug));
    if (distinctPhones.size > 1) {
      const { provider, statedMinPrice } = group[0];
      warnings.push(
        `${provider}: kasserede ${statedMinPrice} kr., som blev fundet identisk for ` +
          `${[...distinctPhones].join(", ")} — et beløb, der er ens på tværs af modeller, ` +
          `hører til siden og ikke til telefonen`,
      );
      continue;
    }
    kept.push(...group);
  }

  return { kept, warnings };
}
