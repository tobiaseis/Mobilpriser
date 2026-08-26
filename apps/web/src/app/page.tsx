import { EgetAbonnement } from "./EgetAbonnement";
import { Telefonliste } from "./Telefonliste";
import { loadLatest, loadPhones, loadReference } from "@/lib/data";
import { formatKr } from "@/lib/format";
import { offersForPhone, type Offer, type PhoneTarget } from "@/lib/model";

/**
 * Overskriftens tal: den største forskel mellem billigste og dyreste tilbud
 * på én og samme telefon.
 *
 * Det er hele sitets begrundelse i ét beløb, og det er sandt uanset eget
 * abonnement — alle tilbud får det samme trukket fra, så spændet står
 * uændret. Derfor kan det regnes her på serveren og bygges ind i siden.
 */
function largestSpread(
  phones: PhoneTarget[],
  offers: Offer[],
): { kr: number; phone: PhoneTarget; count: number } | null {
  let best: { kr: number; phone: PhoneTarget; count: number } | null = null;

  for (const phone of phones) {
    const sorted = offersForPhone(offers, phone.slug);
    if (sorted.length < 2) continue;
    const kr = sorted[sorted.length - 1].minPrice - sorted[0].minPrice;
    if (!best || kr > best.kr) best = { kr, phone, count: sorted.length };
  }

  return best;
}

export default function HomePage() {
  const phones = loadPhones();
  const latest = loadLatest();
  const reference = loadReference();

  const spread = largestSpread(phones, latest.offers);
  const providers = new Set(latest.offers.map((offer) => offer.provider));

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Mindstepris · 6 måneders binding</p>

        {spread ? (
          <h1 className="hero-title">
            Samme telefon. <em className="hero-figure">{formatKr(spread.kr)}</em> i forskel.
          </h1>
        ) : (
          <h1 className="hero-title">Telefon med abonnement, uden regnestykket.</h1>
        )}

        <p className="hero-lede">
          {spread ? (
            <>
              Så meget skiller billigste og dyreste tilbud på en{" "}
              {spread.phone.brand} {spread.phone.model} lige nu — {spread.count} udbydere, samme
              telefon, samme seks måneders binding. Herunder står alle tallene ved siden af
              hinanden, og ved siden af det eneste, der virkelig kan måles imod: hvad telefonen
              koster, hvis du bare køber den.
            </>
          ) : (
            <>
              Danske teleselskaber skal selv oplyse, hvad telefon og abonnement koster tilsammen
              over de seks måneders binding. Her står tallene ved siden af hinanden.
            </>
          )}
        </p>
      </section>

      <EgetAbonnement />

      <section className="section">
        <h2 className="eyebrow">
          {phones.length} telefoner · {providers.size} udbydere
        </h2>
        <Telefonliste
          phones={phones}
          offers={latest.offers}
          cashPrices={reference.cashPrices}
          cheapestMonthly={reference.cheapestMonthly}
        />
        <p className="prose" style={{ marginTop: 18 }}>
          Beløbet er den billigste mindstepris, vi har hentet for telefonen. Linjen under den
          måler tilbuddet mod forhandlerprisen{" "}
          {reference.cheapestMonthly != null && (
            <>plus det billigste abonnement, vi har set ({formatKr(reference.cheapestMonthly)}/md.){" "}</>
          )}
          — den røde streg er det, tilbuddet skal slå. Klik en telefon for at se udbydernes
          tilbud side om side.
        </p>
      </section>
    </>
  );
}
