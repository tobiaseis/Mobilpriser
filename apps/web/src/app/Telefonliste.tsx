"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  calculateReference,
  netOfOwnPlan,
  referenceNetOfOwnPlan,
  verdictFor,
} from "@mobilpriser/core";
import { formatKr } from "@/lib/format";
import type { PhoneCard } from "@/lib/model";
import { useOwnMonthly } from "@/lib/ownPlan";
import { referenceBar } from "@/lib/scale";

/**
 * Hvad der søges i: mærke, model og lager, som det står på kortet.
 *
 * Listen er kort nok til at læses igennem ved hvert tastetryk, og det er
 * pointen — der er ikke noget at indeksere sig ud af, og et indeks ville
 * kun kunne komme ud af trit med det, der faktisk står på skærmen.
 */
function haystack(card: PhoneCard): string {
  return `${card.brand} ${card.model} ${card.storage} GB`.toLowerCase();
}

/**
 * Alle ord skal passe, i vilkårlig rækkefølge.
 *
 * "pixel pro" skal finde Pixel 11 Pro, og "17 pro" skal finde iPhone 17
 * Pro uden også at hive alt andet med 17 i frem. Ét sammenhængende
 * tekststykke ville kræve, at man skrev modelnavnet præcis som vi har
 * skrevet det.
 */
function matches(card: PhoneCard, terms: string[]): boolean {
  const text = haystack(card);
  return terms.every((term) => text.includes(term));
}

export function Telefonliste({
  cards,
  cheapestMonthly,
  providerCount,
}: {
  cards: PhoneCard[];
  cheapestMonthly: number | null;
  providerCount: number;
}) {
  const ownMonthly = useOwnMonthly();
  const [query, setQuery] = useState("");
  const inputId = useId();

  // Afledt under gengivelsen frem for gemt ved siden af feltet: to
  // tilstande, der skal holdes ens, kan komme ud af trit — én kan ikke.
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const shown = searching ? cards.filter((card) => matches(card, terms)) : cards;

  return (
    <>
      <div className="section-bar">
        <h2 className="eyebrow">
          {searching
            ? `${shown.length} af ${cards.length} telefoner`
            : `${cards.length} telefoner · ${providerCount} udbydere`}
        </h2>

        <div className="search">
          <label className="visually-hidden" htmlFor={inputId}>
            Søg efter en telefon
          </label>
          <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13 13l4 4" />
          </svg>
          <input
            id={inputId}
            className="search-input"
            type="search"
            placeholder="Søg — fx Pixel, iPhone, Ultra"
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="Ryd søgningen"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Antallet siges højt, så den der ikke ser gitteret skifte, også
          får at vide at det gjorde. */}
      <p className="visually-hidden" role="status">
        {searching
          ? `${shown.length} af ${cards.length} telefoner passer på "${query}"`
          : `Viser alle ${cards.length} telefoner`}
      </p>

      {shown.length === 0 ? (
        <div className="search-empty">
          <p className="prose">
            Ingen af de {cards.length} telefoner passer på <strong>{query}</strong>. Vi følger
            udvalgte flagskibsmodeller — er der en, du savner, kan den skrives ind i{" "}
            <code>config/phones.yaml</code>.
          </p>
          <button type="button" className="own-plan-reset" onClick={() => setQuery("")}>
            Vis alle telefoner
          </button>
        </div>
      ) : (
        <div className="phone-grid">
          {shown.map((card) => (
            <Link key={card.slug} href={`/telefon/${card.slug}`} className="phone-card">
              <span className="phone-brand">{card.brand}</span>
              <span className="phone-model">{card.model}</span>
              <span className="phone-storage">{card.storage} GB</span>

              {card.minPrice == null || card.provider == null ? (
                <span className="phone-empty">Ingen priser hentet endnu</span>
              ) : (
                <PhonePrice
                  listed={card.minPrice}
                  provider={card.provider}
                  cashPrice={card.cashPrice}
                  cheapestMonthly={cheapestMonthly}
                  ownMonthly={ownMonthly}
                />
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function PhonePrice({
  listed,
  provider,
  cashPrice,
  cheapestMonthly,
  ownMonthly,
}: {
  listed: number;
  provider: string;
  cashPrice: number | null;
  cheapestMonthly: number | null;
  ownMonthly: number | null;
}) {
  const value = ownMonthly != null ? netOfOwnPlan(listed, ownMonthly) : listed;

  // Samme reference som på telefonsiden: kender vi brugerens eget
  // abonnement, er det telefonens kontantpris — ellers kontantprisen plus
  // det billigste abonnement, vi har set.
  const reference =
    cashPrice == null
      ? null
      : ownMonthly != null
        ? referenceNetOfOwnPlan(cashPrice, ownMonthly)
        : cheapestMonthly != null
          ? calculateReference(cashPrice, cheapestMonthly)
          : null;

  const bar = reference == null ? null : referenceBar(value, reference);

  return (
    <>
      <span className="phone-price">{formatKr(value)}</span>
      <span className="phone-provider">
        billigst hos {provider}
        {ownMonthly != null && <span className="was"> · mindstepris {formatKr(listed)}</span>}
      </span>

      {bar && (
        <span className="minibar" aria-hidden="true">
          {bar.segments.map((segment) => (
            <span
              key={segment.kind}
              className="bar-seg"
              data-kind={segment.kind}
              data-end={segment.end ?? undefined}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
            />
          ))}
          <span className="minibar-ref" style={{ ["--ref-pos" as string]: `${bar.refPos}%` }} />
        </span>
      )}

      <PhoneVerdict value={value} reference={reference} />
    </>
  );
}

/**
 * Samme neutrale bånd som på telefonsiden: en forskel på under et par hundrede
 * kroner er ikke en forskel, man skal handle på, og skal ikke stå i rødt.
 */
function PhoneVerdict({ value, reference }: { value: number; reference: number | null }) {
  if (reference == null) {
    return <span className="phone-verdict">Ingen forhandlerpris endnu</span>;
  }

  const verdict = verdictFor(value, reference);
  if (verdict === "neutral") {
    return (
      <span className="phone-verdict">Stort set det samme som at købe telefonen selv</span>
    );
  }

  const diff = value - reference;
  return (
    <span className="phone-verdict" data-tone={verdict === "good" ? "gain" : "over"}>
      {verdict === "good"
        ? `${formatKr(-diff)} billigere end at købe selv`
        : `${formatKr(diff)} dyrere end at købe selv`}
    </span>
  );
}
