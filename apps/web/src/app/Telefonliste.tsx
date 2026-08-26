"use client";

import Link from "next/link";
import {
  calculateReference,
  netOfOwnPlan,
  referenceNetOfOwnPlan,
  verdictFor,
} from "@mobilpriser/core";
import { formatKr } from "@/lib/format";
import { offersForPhone, PROVIDER_NAMES, type Offer, type PhoneTarget } from "@/lib/model";
import { useOwnMonthly } from "@/lib/ownPlan";
import { referenceBar } from "@/lib/scale";

export function Telefonliste({
  phones,
  offers,
  cashPrices,
  cheapestMonthly,
}: {
  phones: PhoneTarget[];
  offers: Offer[];
  cashPrices: Record<string, number>;
  cheapestMonthly: number | null;
}) {
  const ownMonthly = useOwnMonthly();

  return (
    <div className="phone-grid">
      {phones.map((phone) => {
        // Samme beløb trækkes fra alle tilbud, så det billigste tilbud er
        // det samme uanset hvad der står i feltet.
        const cheapest = offersForPhone(offers, phone.slug)[0];
        const cashPrice = cashPrices[phone.slug];

        // Samme reference som på telefonsiden: kender vi brugerens eget
        // abonnement, er det telefonens kontantpris — ellers kontantprisen
        // plus det billigste abonnement, vi har set.
        const reference =
          cashPrice == null
            ? null
            : ownMonthly != null
              ? referenceNetOfOwnPlan(cashPrice, ownMonthly)
              : cheapestMonthly != null
                ? calculateReference(cashPrice, cheapestMonthly)
                : null;

        return (
          <Link key={phone.slug} href={`/telefon/${phone.slug}`} className="phone-card">
            <span className="phone-brand">{phone.brand}</span>
            <span className="phone-model">{phone.model}</span>
            <span className="phone-storage">{phone.storage} GB</span>

            {cheapest ? (
              <PhonePrice
                value={ownMonthly != null ? netOfOwnPlan(cheapest.minPrice, ownMonthly) : cheapest.minPrice}
                listed={cheapest.minPrice}
                showListed={ownMonthly != null}
                provider={PROVIDER_NAMES[cheapest.provider]}
                reference={reference}
              />
            ) : (
              <span className="phone-empty">Ingen priser hentet endnu</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function PhonePrice({
  value,
  listed,
  showListed,
  provider,
  reference,
}: {
  value: number;
  listed: number;
  showListed: boolean;
  provider: string;
  reference: number | null;
}) {
  const bar = reference == null ? null : referenceBar(value, reference);

  return (
    <>
      <span className="phone-price">{formatKr(value)}</span>
      <span className="phone-provider">
        billigst hos {provider}
        {showListed && <span className="was"> · mindstepris {formatKr(listed)}</span>}
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
  const diff = value - reference;

  if (verdict === "neutral") {
    return (
      <span className="phone-verdict">Stort set det samme som at købe telefonen selv</span>
    );
  }

  return (
    <span className="phone-verdict" data-tone={verdict === "good" ? "gain" : "over"}>
      {verdict === "good"
        ? `${formatKr(-diff)} billigere end at købe selv`
        : `${formatKr(diff)} dyrere end at købe selv`}
    </span>
  );
}
