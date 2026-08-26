"use client";

import {
  BINDING_MONTHS,
  calculateReference,
  netOfOwnPlan,
  referenceNetOfOwnPlan,
  verdictFor,
  type Verdict,
} from "@mobilpriser/core";
import { formatDataGb, formatKr } from "@/lib/format";
import { PROVIDER_NAMES, retailerName, type Offer } from "@/lib/model";
import { useOwnMonthly } from "@/lib/ownPlan";

const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Under reference",
  neutral: "Neutral",
  bad: "Over reference",
};

/** Fortegn foran, så en stigning ikke kan forveksles med selve prisen. */
function signed(kr: number): string {
  return `${kr > 0 ? "+" : kr < 0 ? "−" : "±"}${formatKr(Math.abs(kr))}`;
}

export function Sammenligning({
  offers,
  cashPrice,
  cashPriceSource,
  cheapestMonthly,
}: {
  offers: Offer[];
  cashPrice: number | undefined;
  cashPriceSource: string | undefined;
  cheapestMonthly: number | null;
}) {
  const ownMonthly = useOwnMonthly();
  const showNet = ownMonthly != null;

  /** Mindsteprisen, med eget abonnement trukket fra hvis det er oplyst. */
  const net = (minPrice: number) =>
    ownMonthly != null ? netOfOwnPlan(minPrice, ownMonthly) : minPrice;

  // Kender vi brugerens eget abonnement, er referencen telefonens
  // kontantpris: abonnementet betales uanset, og går ud på begge sider.
  // Ellers måles der mod kontantpris plus det billigste abonnement, vi har
  // set — en konservativ målestok.
  const reference =
    cashPrice == null
      ? null
      : ownMonthly != null
        ? referenceNetOfOwnPlan(cashPrice, ownMonthly)
        : cheapestMonthly != null
          ? calculateReference(cashPrice, cheapestMonthly)
          : null;

  const anySaving = showNet && offers.some((offer) => net(offer.minPrice) < 0);

  return (
    <>
      {reference != null && cashPrice != null ? (
        <p className="meta-line">
          {showNet ? (
            <>
              Reference: <strong>{formatKr(cashPrice)}</strong> for telefonen alene
              {cashPriceSource && <> hos {retailerName(cashPriceSource)}</>}. Dit abonnement koster det
              samme, uanset om der følger en telefon med, så de {BINDING_MONTHS} måneder står
              på begge sider af regnestykket og går ud. Tilbage står telefonens pris — og den
              skal tilbuddene slå.
            </>
          ) : (
            <>
              Reference: {formatKr(cashPrice)} kontant for telefonen plus{" "}
              {formatKr(cheapestMonthly!)}/md. i {BINDING_MONTHS} mdr. ={" "}
              <strong>{formatKr(reference)}</strong> Et tilbud under det beløb er billigere
              end at købe telefonen selv og tage det billigste abonnement ved siden af.
            </>
          )}
        </p>
      ) : (
        <div className="warning-box">
          Ingen forhandlerpris er endnu opsamlet for denne telefon, så vurderingskolonnen kan
          ikke sige, om tilbuddene reelt er billige — kun hvordan de rangerer indbyrdes.
        </div>
      )}

      {offers.length === 0 ? (
        <p>Ingen tilbud indsamlet for denne telefon endnu.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Udbyder</th>
                  <th>Abonnement</th>
                  <th>Betal ved køb</th>
                  <th>Abonnement pr. md.</th>
                  <th>Gebyrer</th>
                  <th>{showNet ? `Merpris ${BINDING_MONTHS} mdr.` : `Mindstepris ${BINDING_MONTHS} mdr.`}</th>
                  <th>Vurdering</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const planMonthly = offer.components.planMonthly;
                  return (
                    <tr key={offer.id}>
                      <td>
                        <a href={offer.url} target="_blank" rel="noopener noreferrer">
                          {PROVIDER_NAMES[offer.provider]}
                        </a>
                        {offer.stale && (
                          <span className="badge badge-stale" style={{ marginLeft: 8 }}>
                            Ikke opdateret i dag
                          </span>
                        )}
                      </td>
                      <td>
                        {offer.components.planName ??
                          (offer.components.dataGb != null
                            ? formatDataGb(offer.components.dataGb)
                            : "—")}
                      </td>
                      <td className="num">
                        {offer.components.upfront != null
                          ? formatKr(offer.components.upfront)
                          : "—"}
                      </td>
                      <td className="num">
                        {planMonthly != null ? `${formatKr(planMonthly)}/md.` : "—"}
                        {showNet && planMonthly != null && (
                          <span className="cell-note">
                            {signed(planMonthly - ownMonthly)} mod i dag
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {offer.components.setupFee ? formatKr(offer.components.setupFee) : "—"}
                      </td>
                      <td className="num min-price">
                        {formatKr(net(offer.minPrice))}
                        {offer.source === "computed" && (
                          <span
                            className="badge badge-computed"
                            title="Udbyderen oplyser ikke en samlet mindstepris. Tallet er regnet ud af telefonpris og abonnement."
                          >
                            beregnet
                          </span>
                        )}
                        {showNet && (
                          <span className="cell-note">
                            mindstepris {formatKr(offer.minPrice)}
                          </span>
                        )}
                      </td>
                      <td>
                        {reference == null ? (
                          <span className="badge badge-unknown">Ingen reference endnu</span>
                        ) : (
                          <VerdictBadge minPrice={net(offer.minPrice)} reference={reference} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showNet && (
            <p className="meta-line">
              Merprisen er mindsteprisen minus {formatKr(ownMonthly * BINDING_MONTHS)} —{" "}
              {BINDING_MONTHS} måneder af dit eget abonnement. Alle tilbud får det samme
              trukket fra, så rækkefølgen er uændret; det, der ændrer sig, er hvad telefonen
              koster dig, og hvad tallet skal måles imod.
              {anySaving && (
                <>
                  {" "}
                  Et beløb under nul betyder, at du over de {BINDING_MONTHS} måneder betaler
                  mindre end i dag: udbyderens abonnement er billigere end dit, og telefonen
                  følger med.
                </>
              )}
            </p>
          )}
        </>
      )}
    </>
  );
}

function VerdictBadge({ minPrice, reference }: { minPrice: number; reference: number }) {
  const verdict = verdictFor(minPrice, reference);
  const className =
    verdict === "good" ? "badge-good" : verdict === "bad" ? "badge-bad" : "badge-neutral";
  return <span className={`badge ${className}`}>{VERDICT_LABEL[verdict]}</span>;
}
