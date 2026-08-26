import { EgetAbonnement } from "./EgetAbonnement";
import { Telefonliste } from "./Telefonliste";
import { loadLatest, loadPhones, loadReference } from "@/lib/data";
import { formatKr } from "@/lib/format";
import {
  summariseOffers,
  toPhoneCards,
  type Offer,
  type PhoneOfferSummary,
  type PhoneTarget,
} from "@/lib/model";

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
  summaries: Map<string, PhoneOfferSummary>,
): { kr: number; phone: PhoneTarget; count: number } | null {
  let best: { kr: number; phone: PhoneTarget; count: number } | null = null;

  for (const phone of phones) {
    const summary = summaries.get(phone.slug);
    if (summary === undefined || summary.count < 2) continue;

    const kr = summary.dearest.minPrice - summary.cheapest.minPrice;
    if (best === null || kr > best.kr) best = { kr, phone, count: summary.count };
  }

  return best;
}

/** Hvor mange udbydere der overhovedet er hentet et tilbud fra. */
function countProviders(offers: Offer[]): number {
  const seen = new Set<string>();
  for (const offer of offers) seen.add(offer.provider);
  return seen.size;
}

export default function HomePage() {
  const phones = loadPhones();
  const latest = loadLatest();
  const reference = loadReference();

  // Ét gennemløb af tilbuddene dækker både overskriften og alle fem kort.
  const summaries = summariseOffers(latest.offers);
  const spread = largestSpread(phones, summaries);
  const cards = toPhoneCards(phones, summaries, reference.cashPrices);

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
        {/* Overskriften hører til søgefeltet: den tæller, hvad der står i
            gitteret, og det tal ændrer sig, når der søges. */}
        <Telefonliste
          cards={cards}
          cheapestMonthly={reference.cheapestMonthly}
          providerCount={countProviders(latest.offers)}
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
