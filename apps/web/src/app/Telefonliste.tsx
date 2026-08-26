"use client";

import Link from "next/link";
import { netOfOwnPlan } from "@mobilpriser/core";
import { formatKr } from "@/lib/format";
import { offersForPhone, PROVIDER_NAMES, type Offer, type PhoneTarget } from "@/lib/model";
import { useOwnMonthly } from "@/lib/ownPlan";

export function Telefonliste({
  phones,
  offers,
}: {
  phones: PhoneTarget[];
  offers: Offer[];
}) {
  const ownMonthly = useOwnMonthly();

  return (
    <div className="phone-grid">
      {phones.map((phone) => {
        // Samme beløb trækkes fra alle tilbud, så det billigste tilbud er
        // det samme uanset hvad der står i feltet.
        const cheapest = offersForPhone(offers, phone.slug)[0];

        return (
          <Link key={phone.slug} href={`/telefon/${phone.slug}`} className="phone-card">
            <h2>
              {phone.brand} {phone.model}
            </h2>
            {cheapest ? (
              <>
                <p className="price">
                  {formatKr(
                    ownMonthly != null
                      ? netOfOwnPlan(cheapest.minPrice, ownMonthly)
                      : cheapest.minPrice,
                  )}
                </p>
                <p className="provider">
                  {PROVIDER_NAMES[cheapest.provider]}
                  {ownMonthly != null && (
                    <span className="price-before">
                      mindstepris {formatKr(cheapest.minPrice)}
                    </span>
                  )}
                </p>
              </>
            ) : (
              <p className="empty">Ingen data endnu</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
