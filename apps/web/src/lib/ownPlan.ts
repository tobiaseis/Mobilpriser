"use client";

import { useSyncExternalStore } from "react";

/**
 * Hvad den besøgende betaler for sit abonnement i dag — eller regner med at
 * give fremover.
 *
 * Sitet er statisk og har ingen server at gemme i, og tallet skal følge med
 * fra forsiden ind på hver telefonside. Derfor localStorage. Beløbet
 * forlader aldrig maskinen: der er ingen at sende det til.
 */
const STORAGE_KEY = "mobilpriser.eget-abonnement";

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

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * Returnerer den rå streng, ikke et tal. React sammenligner det, den får
 * her, fra gengivelse til gengivelse, og en streng er den samme hver gang —
 * hvor et nyudregnet objekt ville sætte den i ring.
 */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? inMemory;
  } catch {
    return inMemory;
  }
}

export function setOwnMonthly(value: string): void {
  inMemory = value.trim() === "" ? null : value;
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
export function useOwnMonthlyRaw(): string | null {
  return useSyncExternalStore(subscribe, readRaw, () => null);
}

export function useOwnMonthly(): number | null {
  return parseOwnMonthly(useOwnMonthlyRaw());
}
