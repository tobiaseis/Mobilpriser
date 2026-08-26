"use client";

import { useSyncExternalStore } from "react";

/**
 * Hvad den besøgende betaler for sit abonnement i dag — eller regner med at
 * give fremover.
 *
 * Sitet er statisk og har ingen server at gemme i, og tallet skal følge med
 * fra forsiden ind på hver telefonside. Derfor localStorage. Beløbet
 * forlader aldrig maskinen: der er ingen at sende det til.
 *
 * Nøglen har et versionsnummer. Skal det, der ligger dér, en dag betyde
 * noget andet, kan den nye udgave skrives under sit eget navn frem for at
 * skulle gætte, hvad et gammelt tal stod for.
 */
const STORAGE_KEY = "mobilpriser.eget-abonnement:v1";

/** Nøglen fra før versionsnummeret. Læses én gang og flyttes med over. */
const LEGACY_KEY = "mobilpriser.eget-abonnement";

/** Egen begivenhed, fordi "storage" kun rammer de *andre* faneblade. */
const CHANGED = "mobilpriser:eget-abonnement";

/** Højeste beløb, der kan være en månedlig abonnementspris i kroner. */
export const MAX_OWN_MONTHLY = 2000;

/**
 * Reserve, når lagring er slået fra — privat vindue, blokerede cookies.
 * Uden den ville feltet være dødt at skrive i frem for blot at glemme
 * tallet ved næste sidevisning.
 */
let inMemory: string | null = null;

/**
 * Sidst læste værdi, både rå og udregnet.
 *
 * localStorage er synkront, og React spørger getSnapshot både under
 * gengivelsen og igen bagefter for at kontrollere, at svaret holdt sig i
 * ro. Med tre komponenter, der lytter, blev det til en håndfuld opslag i
 * lageret ved hvert tastetryk i feltet. Værdien kan kun ændre sig to
 * steder — når vi selv skriver den, og når et andet faneblad gør — og
 * begge steder ryddes cachen.
 *
 * Det udregnede tal ligger med, så det er den samme kontrol, der gælder
 * begge: React sammenligner det, getSnapshot returnerer, fra gengivelse
 * til gengivelse, og en ny udregning ved hvert opslag ville være et nyt
 * svar hver gang.
 */
let snapshot: { raw: string | null; monthly: number | null } | null = null;

function readSnapshot(): { raw: string | null; monthly: number | null } {
  if (snapshot === null) {
    const raw = readRawFromStorage();
    snapshot = { raw, monthly: parseOwnMonthly(raw) };
  }
  return snapshot;
}

function readRawFromStorage(): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored;

    // Tallet blev gemt, før nøglen fik et versionsnummer. Det flyttes med
    // over, så den der allerede har skrevet sit abonnement ind, ikke
    // møder et tomt felt.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_KEY);
      return legacy;
    }
    return inMemory;
  } catch {
    return inMemory;
  }
}

function subscribe(onChange: () => void): () => void {
  // Et andet faneblad har skrevet: vores cache ved intet om det og skal
  // ryddes, før React spørger efter den nye værdi.
  const changedElsewhere = () => {
    snapshot = null;
    onChange();
  };

  window.addEventListener("storage", changedElsewhere);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", changedElsewhere);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function setOwnMonthly(value: string): void {
  inMemory = value.trim() === "" ? null : value;
  snapshot = { raw: inMemory, monthly: parseOwnMonthly(inMemory) };

  try {
    if (inMemory === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, inMemory);
  } catch {
    // Beløbet huskes ikke til næste side, men virker på denne.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * Tallet, eller null hvis feltet er tomt eller indeholder noget, der ikke
 * er et brugbart beløb. Null betyder "vis mindsteprisen som den er" —
 * aldrig "regn med nul kroner", for de to ting er ikke det samme.
 */
export function parseOwnMonthly(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw.trim().replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(value) || value < 0 || value > MAX_OWN_MONTHLY) return null;
  return value;
}

/** Serveren kender ikke browserens lager og svarer null, så den byggede
 *  HTML altid viser mindsteprisen ubehandlet. */
const serverRaw = () => null;
const serverMonthly = () => null;

/** Den rå streng — kun feltet selv har brug for den. */
export function useOwnMonthlyRaw(): string | null {
  return useSyncExternalStore(subscribe, () => readSnapshot().raw, serverRaw);
}

/**
 * Beløbet, som resten af sitet regner med.
 *
 * Den, der kun skal bruge tallet, følger tallet — ikke strengen. "0149" og
 * "149 " er to forskellige strenge og det samme beløb, og en liste med fem
 * telefonkort skal ikke tegnes om, fordi tegnene omkring tallet flyttede
 * sig.
 */
export function useOwnMonthly(): number | null {
  return useSyncExternalStore(subscribe, () => readSnapshot().monthly, serverMonthly);
}
