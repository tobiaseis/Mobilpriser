"use client";

import Link from "next/link";
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

export function Telefonliste({
  cards,
  cheapestMonthly,
}: {
  cards: PhoneCard[];
  cheapestMonthly: number | null;
}) {
  const ownMonthly = useOwnMonthly();

  return (
    <div className="phone-grid">
      {cards.map((card) => (
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
