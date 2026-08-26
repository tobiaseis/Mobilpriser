"use client";

import {
  BINDING_MONTHS,
  calculateReference,
  netOfOwnPlan,
  referenceNetOfOwnPlan,
  verdictFor,
  type Verdict,
} from "@mobilpriser/core";
import { formatDataGb, formatKr, formatKrSigned } from "@/lib/format";
import { PROVIDER_NAMES, retailerName, type Offer } from "@/lib/model";
import { useOwnMonthly } from "@/lib/ownPlan";
import { barScale } from "@/lib/scale";

const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Under reference",
  neutral: "Omkring reference",
  bad: "Over reference",
};

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

  if (offers.length === 0) {
    return (
      <p className="prose">
        Ingen priser hentet for denne telefon endnu. Kørslen henter én gang i døgnet — kig
        forbi i morgen.
      </p>
    );
  }

  const values = offers.map((offer) => net(offer.minPrice));
  const scale = barScale(values, reference);
  const anySaving = showNet && values.some((value) => value < 0);
  const anyOver = reference != null && values.some((value) => value > reference);

  return (
    <>
      {reference != null && cashPrice != null ? (
        <p className="prose" style={{ marginBottom: 20 }}>
          {showNet ? (
            <>
              Referencen er <strong>{formatKr(cashPrice)}</strong> — telefonen alene
              {cashPriceSource && <> hos {retailerName(cashPriceSource)}</>}. Dit abonnement
              koster det samme, uanset om der følger en telefon med, så de {BINDING_MONTHS}{" "}
              måneder står på begge sider af regnestykket og går ud. Tilbage står telefonens
              pris — og den skal tilbuddene slå.
            </>
          ) : (
            <>
              Referencen er <strong>{formatKr(reference)}</strong>: {formatKr(cashPrice)}{" "}
              kontant for telefonen
              {cashPriceSource && <> hos {retailerName(cashPriceSource)}</>} plus{" "}
              {formatKr(cheapestMonthly!)}/md. i {BINDING_MONTHS} måneder. Et tilbud under det
              beløb er billigere end at købe telefonen selv og tage det billigste abonnement ved
              siden af.
            </>
          )}
        </p>
      ) : (
        <div className="notice" style={{ marginBottom: 20 }}>
          Ingen forhandlerpris er hentet for denne telefon endnu, så bjælkerne viser kun,
          hvordan tilbuddene ligger indbyrdes — ikke om de er billige.
        </div>
      )}

      <figure className="bjaelke">
        <div className="bjaelke-rows">
          {offers.map((offer, index) => (
            <Bjaelke
              key={offer.id}
              row={index + 1}
              offer={offer}
              value={net(offer.minPrice)}
              cheapest={index === 0}
              showListed={showNet}
              segments={scale.segments(net(offer.minPrice))}
            />
          ))}

          {/* Stregerne ligger i sporets egen søjle og løber gennem hele
              stakken — aldrig hen over et navn eller et beløb. Slutlinjen
              skrives ud: rækkerne er implicitte, og "-1" ville pege på
              samme linje som "1" og klemme overlægget sammen til intet. */}
          <span
            className="bjaelke-overlay"
            style={{ gridRowStart: 1, gridRowEnd: offers.length + 1 }}
            aria-hidden="true"
          >
            {scale.showZero && (
              <span className="bjaelke-zero" style={{ left: `${scale.zeroPos}%` }} />
            )}
            {scale.refPos != null && (
              <span className="bjaelke-ref" style={{ left: `${scale.refPos}%` }} />
            )}
          </span>
        </div>

        <figcaption className="bjaelke-key">
          <span className="key-item">
            <span className="key-mark" aria-hidden="true" />
            {showNet ? `Merpris over ${BINDING_MONTHS} mdr.` : `Mindstepris, ${BINDING_MONTHS} mdr.`}
          </span>
          {reference != null && (
            <span className="key-item">
              <span className="key-mark" data-kind="ref" aria-hidden="true" />
              Reference {formatKr(reference)}
            </span>
          )}
          {anyOver && (
            <span className="key-item">
              <span className="key-mark" data-kind="over" aria-hidden="true" />
              Det du betaler for meget
            </span>
          )}
          {anySaving && (
            <span className="key-item">
              <span className="key-mark" data-kind="gain" aria-hidden="true" />
              Under nul: du betaler mindre end i dag
            </span>
          )}
        </figcaption>
      </figure>

      <section className="section">
        <h2 className="eyebrow">Sådan er prisen sat sammen</h2>

        <div className="table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Udbyder</th>
                  <th scope="col">Abonnement</th>
                  <th scope="col" className="num">
                    Betal ved køb
                  </th>
                  <th scope="col" className="num">
                    Pr. måned
                  </th>
                  <th scope="col" className="num">
                    Gebyrer
                  </th>
                  <th scope="col" className="num">
                    {showNet ? `Merpris, ${BINDING_MONTHS} mdr.` : `Mindstepris, ${BINDING_MONTHS} mdr.`}
                  </th>
                  <th scope="col">Vurdering</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const planMonthly = offer.components.planMonthly;
                  return (
                    <tr key={offer.id}>
                      <th scope="row">
                        <a
                          className="provider-link"
                          href={offer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {PROVIDER_NAMES[offer.provider]}
                        </a>
                        {offer.stale && (
                          <span className="cell-note">ikke opdateret i dag</span>
                        )}
                      </th>
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
                        {planMonthly != null ? `${formatKr(planMonthly)}` : "—"}
                        {showNet && planMonthly != null && (
                          <span className="cell-note">
                            {formatKrSigned(planMonthly - ownMonthly)} mod i dag
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {offer.components.setupFee ? formatKr(offer.components.setupFee) : "—"}
                      </td>
                      <td className="num total">
                        {formatKr(net(offer.minPrice))}
                        {showNet && (
                          <span className="cell-note">
                            mindstepris {formatKr(offer.minPrice)}
                          </span>
                        )}
                      </td>
                      <td>
                        {reference == null ? (
                          <span className="badge badge-unknown">Ingen reference</span>
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
        </div>
        <p className="table-hint">Træk tabellen til siden for at se alle kolonner.</p>

        {showNet && (
          <p className="prose" style={{ marginTop: 18 }}>
            Merprisen er mindsteprisen minus {formatKr(ownMonthly * BINDING_MONTHS)} —{" "}
            {BINDING_MONTHS} måneder af dit eget abonnement. Alle tilbud får det samme trukket
            fra, så rækkefølgen er uændret; det, der ændrer sig, er hvad telefonen koster dig,
            og hvad tallet skal måles imod.
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
      </section>
    </>
  );
}

/**
 * Én række: navn, spor, beløb — hver i sin søjle og på sin egen række, sat
 * eksplicit. Automatisk placering ville springe uden om det overlæg, der
 * tegner stregerne, og skubbe rækkerne ud af trit.
 */
function Bjaelke({
  row,
  offer,
  value,
  cheapest,
  showListed,
  segments,
}: {
  row: number;
  offer: Offer;
  value: number;
  cheapest: boolean;
  showListed: boolean;
  segments: ReturnType<ReturnType<typeof barScale>["segments"]>;
}) {
  return (
    <>
      <div className="bar-label" style={{ gridRow: row, gridColumn: 1 }}>
        <a className="bar-name" href={offer.url} target="_blank" rel="noopener noreferrer">
          {PROVIDER_NAMES[offer.provider]}
        </a>
        <span className="bar-tags">
          {cheapest && <span className="tag tag-best">Billigst</span>}
          {offer.source === "computed" && (
            <span
              className="tag tag-computed"
              title="Udbyderen oplyser ikke en samlet mindstepris. Tallet er regnet ud af telefonpris og abonnement."
            >
              beregnet
            </span>
          )}
        </span>
      </div>

      <div className="bar-track" style={{ gridRow: row, gridColumn: 2 }}>
        {segments.map((segment) => (
          <span
            key={segment.kind}
            className="bar-seg"
            data-kind={segment.kind}
            data-end={segment.end ?? undefined}
            style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
          />
        ))}
      </div>

      <div className="bar-value" style={{ gridRow: row, gridColumn: 3 }}>
        {formatKr(value)}
        {showListed && <span className="bar-sub">mindstepris {formatKr(offer.minPrice)}</span>}
      </div>
    </>
  );
}

function VerdictBadge({ minPrice, reference }: { minPrice: number; reference: number }) {
  const verdict = verdictFor(minPrice, reference);
  const className =
    verdict === "good" ? "badge-good" : verdict === "bad" ? "badge-bad" : "badge-neutral";
  return <span className={`badge ${className}`}>{VERDICT_LABEL[verdict]}</span>;
}
